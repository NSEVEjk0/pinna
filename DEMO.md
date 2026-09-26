# Demo script

A three-minute walkthrough. Everything here runs on the **Moderato testnet**
(chain 42431), so nothing real moves.

## Before you start

1. Two browser profiles (or two browsers) — one for the **host** (the person
   who is owed), one for the **payer**. Different wallets, or the same wallet
   in two profiles, both funded from the faucet.
2. Get test funds: open `/sync`-adjacent docs link, or the faucet at
   `https://tempo.xyz/developers/docs/guide/getting-funds`, for both wallets.
3. Have the app running (`npm run dev`, or the deployed URL).

## The walkthrough

**0:00 — Frame it.** "Pinna is a contacts list that pays. You write a list, sign
once, and every payment carries a memo saying what it was for."

**0:15 — Contacts.** Open `/contacts`, add one person (name + Tempo address).
Tap them: *Send money to X*. Note the contact follows the wallet.

**0:35 — Send a list (the batch).** On `/send`, add two rows for the *same*
person ($25 Friday, $25 Saturday) and one for someone else. Point out the
review screen groups the person but says **3 transfers** — rows are never
merged. Sign once. Show the single transaction hash on the explorer and the
**two separate transfers** inside it, each with its own memo.

> This is the Tempo Transactions `calls` batch: one signature, N calls, atomic.

**1:05 — Request + pay link.** Switch to the host wallet. Open `/request`, add a
row, set an expiry, tick **Pay link** and **Draft message**, write a note for
the payer. Create it. Copy the link.

**1:20 — Pay it from the other side.** Paste the link into the payer profile.
Show the public pay page: amount, who is asking, the note. Connect and pay.
Point out the fee is paid **in the same stablecoin** — no gas token — and note
whether sponsorship is on (the payer needs nothing but the token).

**1:45 — The receipt proves itself.** The page flips to a receipt with the
transaction hash and a **copy-confirmation** message. Switch back to the host:
`/history` → the request has moved from **Waiting** to settled, matched by the
memo, with the hash and a downloadable PDF.

**2:05 — History is the chain's.** Press **Sync from Tempo**. Show that sent and
received rows come from chain data with hashes and times, not local memory.
Show **Repeated payments** flagged.

**2:25 — Agents can pay (MPP).** On the pay page, copy the agent endpoint and
run it:

```bash
curl -i "<pay-page-url>"          # the /api/pay/<id>?d=... endpoint
```

Show the **402** with `WWW-Authenticate: Payment method="tempo" intent="charge"`
and the RFC 9457 problem body naming the amount, token and recipient. This is
the same request a person pays, spoken to a machine in Tempo's Machine Payments
Protocol.

**2:50 — Close.** "One signature for a list, a memo that makes the record
self-explaining, and the same request answers a person or an agent."

## If something is slow

- Chain reads can lag; the **Check Tempo** / **Sync from Tempo** buttons re-read.
- If the payer is on the wrong network, the app offers to add/switch the chain.
- Testnet is not always reliable — the header says so, and the README repeats it.
