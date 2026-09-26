# Pinna — pitch

> **Pay a list, request money, and keep every receipt — on Tempo.**

Pinna is a contacts list that pays. You keep the people you pay, write a list
of payments, and settle the whole list with one signature. The money lives on
[Tempo](https://tempo.xyz), a payments-first Layer 1 where the stablecoin
doubles as the gas token.

Built for the **Colosseum Crypto World's Fair — Tempo Track**.

---

## The problem

Most money between people is small, repeated and social: rent, a split bill, a
weekly wage, an invoice, a contractor's monthly retainer. It is still done by
hand and it is still lossy:

- someone has to work out who owes what, and chase it;
- the payment arrives with no explanation, so nobody remembers what it was for;
- the proof is a screenshot in a chat thread;
- a batch payroll means one wallet popup per person;
- and the recipient cannot *ask* — they can only remind, repeatedly, by hand.

The tools that exist fall into two camps: **consumer apps** that hold your
money and your identity, and **generic multisend dashboards** built for
treasury teams. Neither is a contact list that pays.

## The product

**Send.** A row per payment — person, amount, reason. The same person can
appear on several rows on purpose; rows are never merged. One signature
settles the lot, and every row is its own TIP-20 transfer carrying its own
32-byte memo.

**Request.** Ask for what you are owed. Choose how it goes out, per request:
a public pay link that anybody can open and pay in one tap, a PDF draft you
send yourself, or nothing at all as a reminder. A request waits until the app
sees a matching transfer on chain, or until you mark it paid.

**Reconcile.** History is read from Tempo itself, not from what this browser
remembers: sent and received transfers with their hashes, times and
counterparties, plus flagging for anyone paid the same amount more than once.

**Agents can pay too.** The same request answers a machine in the Machine
Payments Protocol: ask without paying and it returns a `402` challenge naming
the amount, token and recipient; present a credential and it verifies the
transfer on chain and returns a `Payment-Receipt`.

## Why this is Tempo-native, not multi-chain

Pinna is built out of Tempo's own primitives, and could not be built the same
way anywhere else:

| Tempo primitive | How Pinna uses it |
| --- | --- |
| **Tempo Transactions — batched `calls`** | A whole list of payments is one atomic transaction, one signature. Not N popups. |
| **TIP-20 structured memos** | Every transfer carries a reference, so a payment *is* the record of what it was for. This is what makes history reconcile itself. |
| **Stablecoin-native gas** | The fee is paid in the token being sent. There is no volatile gas token to hold, so a payer who has the stablecoin has everything. |
| **Fee sponsorship (`feePayer`)** | A sponsor can pay the payer's fee, so paying a link needs no gas at all. |
| **Scheduled execution (`validAfter`/`validBefore`)** | A scheduled payment carries its own validity window, so the chain enforces which period a run belongs to. |
| **Machine Payments Protocol (MPP)** | Requests settle with machines over HTTP — `402` challenge, credential, verified receipt — via the `mppx` SDK. |

The design decision that matters: **the memo is the reconciliation layer.**
Tempo's structured memos mean Pinna never needs a central ledger to know what a
payment was for. A payment and its receipt are the same object.

## Market

Tempo is built for exactly the flows Pinna serves — the docs name *global
payouts & payroll, remittances, microtransactions, embedded finance and
agentic commerce* as the target use cases.

The wedge is the person who is **always the one collecting**: the small
employer running weekly payroll, the freelancer invoicing clients, the
flatmate who pays the bills, the contractor paying a roster of vendors. It is
a large, unglamorous, recurring flow with a clear payer: whoever currently
loses hours to chasing and reconciling.

Rough shape of the opportunity (to be sized properly in the deck):

- **Bottom-up:** freelancers, small teams and households settling recurring
  shared costs on stablecoins.
- **Top-down:** payroll and vendor payouts for stablecoin-native businesses,
  where the batch-plus-memo primitive replaces CSV-and-spreadsheet workflows.

## Business model

Pinna holds no funds and takes no cut of a transfer. The plausible revenue
lines, in order of how quickly they could be turned on:

1. **Sponsorship margin.** Fee sponsorship is a service: a business pays to
   make its payers gasless. Metered per sponsored transaction.
2. **Team plan.** Shared contact books and recurring lists across a team,
   above a free personal tier (sync is already built and encrypted
   client-side).
3. **Agent metering.** Machine payments are metered by nature; Pinna is the
   endpoint an agent pays, so it can sit in that flow.
4. **Reconciliation as the hook.** The memo-backed record is what a business
   actually keeps paying for once it has it.

## Traction and status

Honest snapshot as of **2026-09-24** (submissions close 2026-10-12):

- The app is **built and passing**: 116 tests, clean typecheck, production
  build.
- **Source is open** (MIT), and the components are reusable — the memo codec,
  batch builder, ledger and MPP route are all separable.
- **Not yet deployed publicly** and no external users yet; the demo runs on
  the Moderato testnet.
- What is *not* built is labelled as such in the app rather than implied (the
  autonomy agent on `/automation` says "under development" on the page).

Recognition of the gap is deliberate: the next milestones are the ones that
turn a working product into a business.

## Roadmap

1. **Now → submission:** deploy a public demo, record the walkthrough, seed a
   demo host and request.
2. **Post-hackathon:** mainnet deployment with a funded fee-payer, so
   sponsorship works for real users.
3. **Then:** MCP server so any agent framework can pay a Pinna request as a
   tool; team contact books on the existing encrypted sync.
4. **Later:** receive policies and virtual addresses (one deposit address per
   counterparty) for business reconciliation; stablecoin FX via Tempo's DEX
   for cross-currency payouts.

## Team

Built by **CK** ([@CRYPTFRANI](https://x.com/CRYPTFRANI)). Solo founder,
building full-time on this.

## Links

- Tempo: [tempo.xyz](https://tempo.xyz) · docs: [tempo.xyz/developers/docs](https://tempo.xyz/developers/docs)
- Machine Payments Protocol: [mpp.dev/protocol](https://mpp.dev/protocol)
- Colosseum Crypto World's Fair: [colosseum.com/worldsfair](https://colosseum.com/worldsfair)

---

*Figures marked "to be sized" are placeholders: fill them from real research
before the pitch, do not ship a guess as a number.*
