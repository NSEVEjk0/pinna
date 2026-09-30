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
  what: "Tempo is a payments-first blockchain built by Stripe and Paradigm. The money on it is stablecoins, transfers settle in about half a second, and the fee is paid in the same stablecoin you are sending — so there is no separate gas token to buy first. That is what lets a whole list of payments leave your wallet as one transaction, each one carrying a note saying what it was for.",
  goal:
    "Pinna is a simplified payment hub on Tempo — a contact list that pays. Most payments between people are small and simple, and happen several times a day. Checking a wallet to work out which payment was for what is one of the biggest reasons crypto still is not the everyday way people pay, and Pinna is here to change that. Everything you would normally do to move money, Pinna makes easier. It is built for business owners and for anyone on the receiving side of many transactions.",
} as const;

/**
 * How Pinna works, from each side of the money. Sending and receiving are what
 * a business actually does all day; requesting and reminders are what stops
 * either side having to chase.
 */
export const HOW_IT_WORKS = [
  {
    title: "Sending",
    summary: "Pay one person or fifty, in a single signature.",
    points: [
      "Add a row per payment — who, how much, and what for. The same person can appear on several rows on purpose.",
      "Review groups the rows by person, but they are never merged: every row is its own transfer with its own reference.",
      "One signature settles the whole list. The fee comes out of the same stablecoin you are sending.",
    ],
  },
  {
    title: "Receiving",
    summary: "Know the moment money lands — and what it was for.",
    points: [
      "Pinna watches Tempo while the app is open, so a request turns paid seconds after the transfer arrives.",
      "Every transfer carries its reason, so your history explains itself instead of you matching a payment to a chat message.",
      "Sent, received and waiting export as CSV, and every payment downloads as a PDF receipt.",
    ],
  },
  {
    title: "Requesting",
    summary: "Ask for what you are owed, and make it easy to pay.",
    points: [
      "Send a pay link — a public page carrying the whole request. Anyone can open it and pay in one tap, from any wallet they hold.",
      "The transfer carries the request's reference, so the payment matches the ask by itself, whoever sends it.",
      "A reference settles once. A second payment carrying it is flagged in History, so a double payment cannot hide.",
    ],
  },
  {
    title: "Reminders",
    summary: "Keep track of what is still owed, without chasing.",
    points: [
      "Anything unpaid waits under Waiting, with a copy-ready reminder message and a pay link you can attach later.",
      "Cancel a request while it is still open — cancelled ones stay listed, so you can always see what you called off.",
      "Schedule repeating payments daily, weekly, monthly or yearly, each with its own note in the transfer.",
    ],
  },
] as const;

/** The selling points, in the order they matter. */
export const HIGHLIGHTS = [
  {
    title: "One signature, the whole list",
    body: "Fifty payments leave your wallet as a single transaction. No popup per person, and nothing left half-sent.",
  },
  {
    title: "Every payment explains itself",
    body: "The reason is written into the transfer itself, so what was paid, to whom and why is on the record — not in a spreadsheet.",
  },
  {
    title: "It settles while you watch",
    body: "A request turns paid within seconds of the transfer landing. No refreshing, no checking a wallet by hand.",
  },
  {
    title: "Paid twice cannot hide",
    body: "A reference settles once, and a second payment carrying it is flagged for refund with both transaction hashes.",
  },
  {
    title: "Fees in the money you send",
    body: "No gas token to buy first, and fees can be sponsored — so paying costs nothing beyond the amount itself.",
  },
  {
    title: "Nobody holds your money",
    body: "Your wallet signs every transfer. Pinna takes no custody, holds no key, and keeps no database of who owes whom.",
  },
] as const;

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
    title: "Agents can pay, and you can see it",
    body: "An agent can pay a request the same way a person does. Every payment it makes lands in your history with the reference, the reason and the time, so you can see what it did, and why.",
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
    title: "Split a bill",
    body: "Dinner came to $18 each. Send one request and everyone pays from their own wallet — the memo records who paid, and when, so nobody has to dig through a chat.",
    people: ["Jake", "Sophia"],
  },
] as const;
