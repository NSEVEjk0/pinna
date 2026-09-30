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
  what: "Tempo is a payments-first blockchain built by Stripe and Paradigm. The money on it is stablecoins, transfers settle in about half a second, and the fee is paid in the same stablecoin you are sending — so there is no separate gas token to buy first.",
  goal:
    "Most money between people is small, repeated and social — rent, a split bill, a weekly wage, an invoice. It is still handled by hand: working out who owes what, chasing it, and forgetting which payment was for what. Pinna turns a contact list into a payment system. Keep the names, write the reason on every transfer, settle the whole list in one signature, and read the chain afterwards so nobody has to be taken on trust. It is built for the person who is always the one collecting.",
  onTempo:
    "A whole list — several people, several payments — leaves your wallet as one signed batch, and every row carries a memo saying what it was for. The fee is paid in the same stablecoin, so there is nothing to buy first, and the record of who was paid for what lives on the chain instead of in a spreadsheet.",
  steps: [
    "Add the people you pay, once.",
    "Write a list of payments, or a request for money you are owed.",
    "Sign once — or send a link and let them pay.",
    "Every transfer carries its reason, so your history explains itself.",
  ],
} as const;

/** Everything Pinna does, in the order someone would meet it. */
export const FEATURES = [
  {
    title: "Contacts",
    body: "The people you pay, saved with a name and a picture you choose. Tap one to send them money or to ask for it.",
  },
  {
    title: "Send a list",
    body: "One row per payment: who, how much, and what for. The same person can appear more than once on purpose.",
  },
  {
    title: "One signature, the whole list",
    body: "A list leaves your wallet as a single Tempo transaction. No popup per person, and nothing left half-sent.",
  },
  {
    title: "Every row its own transfer",
    body: "Rows are never merged. Three payments to one person are three transfers, each carrying its own reference.",
  },
  {
    title: "Request money",
    body: "Ask for what you are owed and send it as a pay link, a PDF, or just a reminder that waits until it is paid.",
  },
  {
    title: "Pay links",
    body: "A public page carrying the whole request. Whoever owes you opens it, connects a wallet, and pays in one tap.",
  },
  {
    title: "Payments settle themselves",
    body: "Pinna watches Tempo while the app is open, so a request turns paid seconds after the transfer lands.",
  },
  {
    title: "Proof and receipts",
    body: "Every payment carries its transaction hash. Download a PDF receipt, or copy a confirmation to send back.",
  },
  {
    title: "History read from the chain",
    body: "Sent and received transfers read from Tempo itself, with the hash, the time and the person on the other side.",
  },
  {
    title: "Paid twice?",
    body: "A reference settles once. A second transfer carrying it is flagged, so a mistaken double payment cannot hide.",
  },
  {
    title: "Repeated payments flagged",
    body: "Paid the same person the same amount more than once? It is grouped with the count and the running total.",
  },
  {
    title: "Scheduled payments",
    body: "Daily, weekly, monthly or yearly at a time you choose, each with its own note written into the transfer.",
  },
  {
    title: "Any stablecoin you hold",
    body: "Switch the payment token in the header, or add any TIP-20 by contract address and pay in that instead.",
  },
  {
    title: "Sync across devices",
    body: "Keep the same list on your phone and your laptop, addressed by your wallet and encrypted in the browser.",
  },
  {
    title: "Export for your records",
    body: "Every payment as a PDF, and sent, received and waiting as CSV — ready for a spreadsheet or an accounts system.",
  },
  {
    title: "Agents can pay too",
    body: "The same request answers a machine: ask without paying and it replies with what is owed, then returns a receipt.",
  },
] as const;

export const EXAMPLE_CARDS = [
  {
    title: "Friday payroll",
    body: "Three people, three transfers, one signature. Every payment carries the week it covers in its memo.",
    people: ["Franklin", "Jake", "Sophia"],
  },
  {
    title: "Flatmates",
    body: "Rent and utilities split three ways. Stephanie pays her share from a link in one tap; the memo says which month.",
    people: ["Franklin", "Sophia", "Stephanie"],
  },
  {
    title: "Freelance invoice",
    body: "Send an invoice as a request with a PDF and a pay link. When the transfer lands, the invoice number comes back in the memo.",
    people: ["Jake"],
  },
  {
    title: "Vendor list",
    body: "Ten vendors, ten amounts, one signature. Every row is its own transfer with its own reference.",
    people: ["Sophia", "Stephanie", "Franklin"],
  },
  {
    title: "Friend reminder",
    body: "Dinner was $18 each. Send the reminder now and take the money later — it waits under Waiting until it is paid.",
    people: ["Jake", "Sophia"],
  },
] as const;
