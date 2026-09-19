"use client";

import { useState } from "react";

/**
 * The questions people actually ask before they let a stranger's link move
 * their money. Kept in one place so the answers stay honest.
 */
export const FAQ = [
  {
    q: "What if I want to pay with a wallet that is different from the one that was used to request funds from me?",
    a: "Pay from whichever wallet you like. As long as the reference id on the transfer stays the same, Pinna assigns the payment to that request — the reference is what ties the money to the ask, not the wallet that was named.",
  },
  {
    q: "Does Pinna ever hold my money?",
    a: "No. Your wallet signs and the transfer goes straight to the person you are paying. Pinna writes the payment and reads the chain; it is never in the middle of the money.",
  },
  {
    q: "Which network should I use?",
    a: "Mainnet. The testnet exists so you can try things without risking anything, but it is not very reliable. Switch between them from the header, beside your wallet.",
  },
  {
    q: "Who pays the fee?",
    a: "The person sending. Fees are paid in the same stablecoin as the transfer, so there is no separate gas token to hold.",
  },
  {
    q: "What if someone pays me twice by mistake?",
    a: "Both transfers are real and both are recorded. History groups repeats by person and amount, with the count and the running total, so a double payment — or a hundredth — is impossible to miss.",
  },
  {
    q: "Can I take back a request?",
    a: "Yes, while it is still waiting. Open it under Waiting in History and cancel it. Cancelled requests stay listed, so you can see what you called off.",
  },
  {
    q: "Do I need an account?",
    a: "No. Your wallet is the identity. Contacts, requests and history are kept in your own browser, and Pinna has no database of who owes whom.",
  },
  {
    q: "What if I send a request without a link?",
    a: "It becomes a reminder: it still shows up under Waiting, you can copy a reminder message, and you can attach a pay link to it later if you change your mind.",
  },
  {
    q: "How far back does History go?",
    a: "History is read from Tempo itself. The automatic check looks at recent blocks; the Sync from Tempo button reaches back much further, about a month.",
  },
  {
    q: "What happens if a payment is made without a reference?",
    a: "Pinna will not call a request paid on a guess. If a transfer looks like it might be the payment, History offers it as a possible match and lets you confirm it yourself.",
  },
  {
    q: "Can Pinna send a payment on its own?",
    a: "No. Scheduled payments come round at the time you set, but Pinna has no key of its own — it puts the payment in front of you and your wallet signs it.",
  },
] as const;

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="shell" style={{ paddingTop: 72 }}>
      <hr className="rule" />
      <p className="eyebrow" style={{ margin: "32px 0 4px" }}>
        Questions
      </p>
      <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)", margin: "0 0 20px" }}>
        Before you move money.
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
