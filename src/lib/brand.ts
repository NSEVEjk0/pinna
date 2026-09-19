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
  goal:
    "Pinna is trying to make a contact list into a payment system. Most money between people is small, repeated and social — rent, a split bill, a weekly wage, an invoice — and it is still done by hand: working out who owes what, chasing it, checking a screenshot, forgetting which payment was for what. Pinna keeps the names, writes the reason onto every transfer, settles the whole list in one signature, and reads the chain afterwards so nobody has to be trusted on their word. It is built for the person who is always the one collecting.",
  onTempo:
    "A whole list — several people, several payments — leaves your wallet as one signed batch, and every row carries a memo saying what it was for. Fees are paid in the same stablecoin, so there is no gas token to buy first, and the record of who was paid for what is on the chain rather than in a spreadsheet.",
  steps: [
    "Add the people you pay, once.",
    "Write a list of payments or a request.",
    "Sign one Tempo batch. Or send a link and let them pay.",
    "Every transfer lands with a memo, so history explains itself.",
  ],
} as const;

/** Everything Pinna does, in the order someone would meet it. */
export const FEATURES = [
  {
    title: "Contacts",
    body: "The people you pay, with a name and a picture you set yourself. Tap one to send to them or ask them for money.",
  },
  {
    title: "Send a list",
    body: "One row per payment — person, amount, reason. The same person can appear twice on purpose. One signature settles the lot.",
  },
  {
    title: "Each row, its own transfer",
    body: "Rows are never merged. Three payments to Jake are three transfers, each with its own reference written into the memo.",
  },
  {
    title: "Request money",
    body: "Ask for what you are owed. Send a pay link, a PDF, or nothing at all as a reminder — it waits under Waiting until it is paid.",
  },
  {
    title: "Pay links",
    body: "A public page carrying the whole request. Whoever owes you opens it, connects a wallet, and pays in one tap — from any wallet.",
  },
  {
    title: "Proof and receipts",
    body: "Every payment carries its hash. Download a PDF receipt, or copy a confirmation to send back to whoever asked.",
  },
  {
    title: "History from the chain",
    body: "Sent and received transfers are read from Tempo itself, marked paid or received, with hash, time and counterparty.",
  },
  {
    title: "Repeat payments flagged",
    body: "If the same person is paid the same amount more than once, it is grouped with the count and the running total.",
  },
  {
    title: "Scheduled payments",
    body: "Daily, weekly, monthly or yearly at a time you choose, each with its own memo. Due runs wait for your signature.",
  },
  {
    title: "Any stablecoin you hold",
    body: "Switch the payment token from the header, or add any TIP-20 by contract address and pay in that.",
  },
  {
    title: "Sync across devices",
    body: "Keep the same list on your phone and laptop, addressed by your wallet. Encrypted in the browser, so the server cannot read it.",
  },
  {
    title: "Agents can pay too",
    body: "The same request answers a machine: ask unpaid and it replies 402 with what is owed, then verifies the transfer and returns a receipt.",
  },
] as const;

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
