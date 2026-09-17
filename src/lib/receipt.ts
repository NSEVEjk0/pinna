import type { PayableRow } from "./money";
import { formatAmount, parseAmount, DEFAULT_DECIMALS } from "./money";

/**
 * Receipts are generated in the browser from the same rows that were signed,
 * so the PDF always matches the batch that went out.
 */

export interface ReceiptInput {
  title: string;
  rows: PayableRow[];
  txHash: string;
  explorerUrl: string;
  at: string;
  tokenSymbol: string;
  network: string;
  from: string;
  decimals?: number;
  note?: string;
}

export interface ReceiptLine {
  name: string;
  address: string;
  amount: string;
  reason: string;
}

export interface ReceiptModel {
  title: string;
  issuedAt: string;
  total: string;
  tokenSymbol: string;
  network: string;
  from: string;
  txHash: string;
  explorerUrl: string;
  lines: ReceiptLine[];
  note?: string;
}

/** Build the flat model the PDF renders from — and what the tests check. */
export function receiptModel(input: ReceiptInput): ReceiptModel {
  const decimals = input.decimals ?? DEFAULT_DECIMALS;
  const totalUnits = input.rows.reduce(
    (acc, r) => acc + parseAmount(r.amount, decimals),
    0n
  );
  return {
    title: input.title,
    issuedAt: input.at,
    total: formatAmount(totalUnits, decimals),
    tokenSymbol: input.tokenSymbol,
    network: input.network,
    from: input.from,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    note: input.note,
    lines: input.rows.map((r) => ({
      name: r.name || r.address,
      address: r.address,
      amount: r.amount,
      reason: r.reason ?? "",
    })),
  };
}

function stamp(iso: string): string {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return iso;
  }
}

/**
 * Render the receipt to a PDF and save it. Imported lazily so the rest of the
 * app (and the tests) never need a browser environment.
 */
export async function downloadReceipt(input: ReceiptInput, filename?: string): Promise<void> {
  const model = receiptModel(input);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 56;
  let y = 72;

  doc.setFont("times", "normal");
  doc.setFontSize(26);
  doc.text("Pinna", margin, y);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(model.title, margin, y + 18);
  doc.setTextColor(0);

  y += 64;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text("ISSUED", margin, y);
  doc.text("NETWORK", margin + 220, y);
  doc.text("PAID TO YOU", margin + 380, y);
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(stamp(model.issuedAt), margin, y + 16);
  doc.text(model.network, margin + 220, y + 16);
  doc.text(model.from, margin + 380, y + 16);

  y += 56;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text("PAYMENT", margin, y);
  doc.text("REFERENCE", margin + 300, y);
  doc.text("AMOUNT", pageWidth - margin, y, { align: "right" });
  doc.setTextColor(0);
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFontSize(11);
  for (const line of model.lines) {
    const yLine = y;
    doc.text(line.name.slice(0, 34), margin, yLine);
    if (line.reason) {
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(line.reason.slice(0, 46), margin + 300, yLine);
      doc.setFontSize(11);
      doc.setTextColor(0);
    }
    doc.text(`${line.amount} ${model.tokenSymbol}`, pageWidth - margin, yLine, {
      align: "right",
    });
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(line.address, margin, y);
    doc.setTextColor(0);
    doc.setFontSize(11);
    y += 22;
  }

  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;
  doc.setFontSize(12);
  doc.text("Total", margin, y);
  doc.text(`${model.total} ${model.tokenSymbol}`, pageWidth - margin, y, { align: "right" });

  y += 40;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Tempo transaction", margin, y);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(model.txHash, margin, y + 14);
  if (model.explorerUrl) {
    doc.setTextColor(110);
    doc.textWithLink(model.explorerUrl, margin, y + 30, { url: model.explorerUrl });
    doc.setTextColor(0);
  }

  if (model.note) {
    y += 56;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(model.note.slice(0, 400), margin, y, { maxWidth: pageWidth - margin * 2 });
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Paid on Tempo. Each transfer carried a reference memo.", margin, doc.internal.pageSize.getHeight() - 48);

  const name = filename || `pinna-${model.txHash.slice(2, 10)}.pdf`;
  doc.save(name);
}
