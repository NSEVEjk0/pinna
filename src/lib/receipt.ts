import type { PayableRow } from "./money";
import { formatAmount, parseAmount, DEFAULT_DECIMALS } from "./money";

/**
 * Receipts are generated in the browser from the same rows that were signed,
 * so the PDF always matches what went out — and it is set in Pinna's own
 * palette: charcoal, sage, and bone.
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
  /** Optional label for the person or list this receipt belongs to. */
  subject?: string;
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
  subject?: string;
}

export const RECEIPT_PALETTE = {
  coal: [22, 22, 22] as [number, number, number],
  sage: [122, 154, 126] as [number, number, number],
  bone: [244, 241, 234] as [number, number, number],
  line: [214, 214, 208] as [number, number, number],
  muted: [120, 120, 116] as [number, number, number],
};

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
    subject: input.subject,
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

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const { coal, sage, bone, line, muted } = RECEIPT_PALETTE;

  // Charcoal masthead, the one block of colour on the page.
  doc.setFillColor(coal[0], coal[1], coal[2]);
  doc.rect(0, 0, pageW, 132, "F");

  // Fern mark, drawn the same geometric way as the app's logo.
  const fx = margin + 6;
  const fy = 34;
  doc.setDrawColor(sage[0], sage[1], sage[2]);
  doc.setLineWidth(1.1);
  doc.line(fx, fy + 58, fx, fy + 10);
  for (let i = 0; i < 6; i++) {
    const y = fy + 54 - i * 8;
    const reach = 15 - i * 1.8;
    doc.line(fx, y, fx - reach, y - reach * 0.7);
    doc.line(fx, y, fx + reach, y - reach * 0.7);
  }

  doc.setTextColor(bone[0], bone[1], bone[2]);
  doc.setFont("times", "normal");
  doc.setFontSize(30);
  doc.text("Pinna", margin + 44, 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(sage[0], sage[1], sage[2]);
  doc.text("NAMES AND REMINDERS · DOLLARS MOVE ON TEMPO", margin + 44, 78);

  doc.setFontSize(11);
  doc.setTextColor(bone[0], bone[1], bone[2]);
  doc.text(model.title, margin + 44, 100);
  if (model.subject) {
    doc.setFontSize(9);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(model.subject, pageW - margin, 100, { align: "right" });
  }

  let y = 168;

  // Fact row
  const facts: [string, string][] = [
    ["ISSUED", stamp(model.issuedAt)],
    ["NETWORK", model.network],
    ["FROM", model.from],
  ];
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  facts.forEach(([label], i) => {
    doc.text(label, margin + i * 168, y);
  });
  doc.setFontSize(9.5);
  doc.setTextColor(coal[0], coal[1], coal[2]);
  facts.forEach(([, value], i) => {
    doc.text(String(value).slice(0, 30), margin + i * 168, y + 14);
  });

  y += 38;
  doc.setDrawColor(sage[0], sage[1], sage[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // Column heads
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("PAYMENT", margin, y);
  doc.text("REFERENCE", margin + 250, y);
  doc.text("AMOUNT", pageW - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // Rows
  for (const entry of model.lines) {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(coal[0], coal[1], coal[2]);
    doc.text(entry.name.slice(0, 34), margin, y);

    if (entry.reason) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(sage[0], sage[1], sage[2]);
      doc.text(entry.reason.slice(0, 44), margin + 250, y);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(coal[0], coal[1], coal[2]);
    doc.text(`${entry.amount} ${model.tokenSymbol}`, pageW - margin, y, { align: "right" });

    y += 12;
    doc.setFontSize(7.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(entry.address, margin, y);
    y += 20;

    if (y > pageH - 170) {
      doc.addPage();
      y = 72;
    }
  }

  // Total
  doc.setDrawColor(sage[0], sage[1], sage[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 22;
  doc.setFont("times", "normal");
  doc.setFontSize(15);
  doc.setTextColor(coal[0], coal[1], coal[2]);
  doc.text("Total", margin, y);
  doc.text(`${model.total} ${model.tokenSymbol}`, pageW - margin, y, { align: "right" });

  // Transaction block
  y += 40;
  doc.setFillColor(246, 245, 241);
  doc.rect(margin, y - 14, pageW - margin * 2, 76, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("TEMPO TRANSACTION", margin + 12, y);
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(coal[0], coal[1], coal[2]);
  const hash = model.txHash || "—";
  doc.text(hash.slice(0, 50), margin + 12, y + 16);
  if (hash.length > 50) doc.text(hash.slice(50), margin + 12, y + 28);
  if (model.explorerUrl) {
    doc.setTextColor(sage[0], sage[1], sage[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.textWithLink(model.explorerUrl, margin + 12, y + 44, { url: model.explorerUrl });
  }

  if (model.note) {
    y += 92;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(model.note.slice(0, 300), margin, y, { maxWidth: pageW - margin * 2 });
  }

  // Footer rule + credit
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 62, pageW - margin, pageH - 62);
  doc.setFontSize(7.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Paid on Tempo. Every transfer carried a reference memo.", margin, pageH - 46);
  doc.setTextColor(sage[0], sage[1], sage[2]);
  doc.textWithLink("Pinna · https://x.com/CRYPTFRANI", pageW - margin, pageH - 46, {
    url: "https://x.com/CRYPTFRANI",
    align: "right",
  });

  const name = filename || `pinna-${hash.slice(2, 10) || "receipt"}.pdf`;
  doc.save(name);
}
