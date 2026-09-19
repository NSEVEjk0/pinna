/**
 * Pinna brand constants and the copy that appears across the app.
 * Kept in one place so the strings are testable.
 */

export const BRAND = {
  name: "Pinna",
  /**
   * One phrase for everything Pinna does: the address book, paying a whole
   * list in one signature, asking to be paid, the reminders, the repeats.
   */
  oneLiner: "Pay a list, request money, and keep every receipt — on Tempo.",
  builtBy: "Built by CK",
  xUrl: "https://x.com/CRYPTFRANI",
  xHandle: "@CRYPTFRANI",
  footer:
    "Tempo is a payments-first blockchain where dollars are the money and the fee at once — no separate token to hold. Pinna uses Tempo batches to pay a whole list in one signature, and memos to write a reason onto every transfer, so the payment is also the record of what it was for.",
} as const;

export const TEMPO_COPY = {
  what: "Tempo is a payments-first Layer 1 blockchain incubated by Stripe and Paradigm. Dollars live on it, transfers settle in seconds, and the fee is paid in the same stablecoin you are sending.",
  goal: "It is built on one idea: moving money should feel like sending a message. Stablecoins are the money and the fee, so there is no gas token to buy first, no chain to think about for the person receiving it, and nothing to reconcile by hand afterwards. Tempo is betting that payments deserve their own chain rather than a corner of a general-purpose one.",
  inPinna:
    "In Pinna, Tempo is the rail. A whole list — several people, several payments — leaves your wallet as one signed batch, and every row carries a memo saying what it was for.",
  steps: [
    "Add the people you pay, once.",
    "Write a list of payments or a request.",
    "Sign one Tempo batch. Or send a link and let them pay.",
    "Every transfer lands with a memo, so history explains itself.",
  ],
} as const;

export const EXAMPLE_CARDS = [
  {
    title: "Friday payroll",
    body: "Franklin, Jake and Sophia, every week, three transfers in one batch, each memoed with the week it covers.",
    people: ["Franklin", "Jake", "Sophia"],
  },
  {
    title: "Flatmates",
    body: "Rent and utilities split three ways. Stephanie pays her share in one tap from a link; the memo says which month.",
    people: ["Franklin", "Sophia", "Stephanie"],
  },
  {
    title: "Freelance invoice",
    body: "Send an invoice as a request with a PDF and a pay link. When the transfer lands, the memo carries the invoice number back.",
    people: ["Jake"],
  },
  {
    title: "Vendor list",
    body: "Ten vendors, ten amounts, one signature. Each row is its own transfer with its own reference.",
    people: ["Sophia", "Stephanie", "Franklin"],
  },
  {
    title: "Friend reminder",
    body: "Dinner was $18 each. Send a reminder now, money later — it sits under Waiting until it is paid.",
    people: ["Jake", "Sophia"],
  },
] as const;
