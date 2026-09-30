"use client";

import { useState } from "react";

/**
 * The questions people actually ask before they let a stranger's link move
 * their money. Kept in one place so the answers stay honest.
 */
export const FAQ = [
  {
    q: "How does Pinna know a request has been paid?",
    a: "Every transfer carries a short reference in its memo. When one arrives carrying that reference, the request settles on its own — usually within seconds of landing on Tempo. Pinna reads this from the chain itself, not from what your browser happens to remember.",
  },
  {
    q: "Can I pay from a wallet that is different from the one that was requested?",
    a: "Yes. The reference id on the transfer is what assigns the payment to that request — not the wallet it came from. Send from any wallet you hold, and a pay link can be paid by anyone you choose to send it to.",
  },
  {
    q: "What if someone pays me twice by mistake?",
    a: "The first transfer settles the request. Any later transfer carrying the same reference is flagged in History under “Paid twice”, with both transaction hashes, so it is obvious what needs refunding. Repeats are also grouped by person and amount, with the count and running total.",
  },
  {
    q: "Does Pinna ever hold my money?",
    a: "No. Your wallet signs every transfer and the money goes straight to the person you are paying. Pinna never takes custody and holds no key of its own.",
  },
  {
    q: "Who pays the fee?",
    a: "The sender, by default — but on Tempo the fee is paid in the same stablecoin as the transfer, so there is no separate gas token to buy first. Fees can also be sponsored, in which case the receiver covers them and paying costs nothing beyond the amount itself.",
  },
  {
    q: "Which network should I use?",
    a: "Mainnet for anything that matters. The testnet exists so you can try things without risking anything, but it is not very reliable. Switch between the two in the header, beside your wallet.",
  },
  {
    q: "Do I need an account?",
    a: "No account and no sign-up. Your wallet is your identity, and your contacts, requests and history are kept in your own browser.",
  },
  {
    q: "Can an AI agent pay a request?",
    a: "Yes. The same request answers a machine in the Machine Payments Protocol: ask without paying and it replies with what is owed, then verifies the transfer on chain and returns a receipt. It is the identical request a person pays, settled by the identical transfer.",
  },
  {
    q: "Can I export my records?",
    a: "Yes. Every settled payment can be downloaded as a PDF receipt, and History exports sent, received and waiting as CSV — with the reference, the transaction hash and a link to the explorer on every row.",
  },
  {
    q: "Can I send a request without a link?",
    a: "Yes. Choose neither a link nor a PDF and it becomes a reminder: it waits under Waiting, you can copy a reminder message, and you can attach a pay link to it later if you change your mind.",
  },
  {
    q: "How far back does History go?",
    a: "History is read from Tempo itself. The automatic check covers recent activity; the Sync from Tempo button reaches back much further — about a month.",
  },
  {
    q: "What happens if a payment arrives without a reference?",
    a: "Pinna will not mark a request paid on a guess. If a transfer looks like it might be the payment, History offers it as a possible match and lets you confirm it yourself.",
  },
  {
    q: "Can Pinna send a payment on its own?",
    a: "No. A scheduled payment comes round at the time you set, but Pinna holds no key of its own — nothing is ever sent without your wallet signing it.",
  },
  {
    q: "Can I take back a request?",
    a: "Yes, while it is still waiting. Open it under Waiting in History and cancel it — cancelled requests stay listed, so you can always see what you called off.",
  },
] as const;

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="shell" style={{ paddingTop: 72 }}>
      <hr className="rule" />
      <p className="eyebrow" style={{ margin: "32px 0 4px" }}>
        FAQ
      </p>
      <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)", margin: "0 0 20px" }}>
        Frequently asked questions
      </h2>

      <div>
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div className="faq-item" key={item.q}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? <p className="faq-a">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
