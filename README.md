# Pinna

**Names and reminders. Dollars move on Tempo.**

Pinna is a contacts list that pays. You keep the people you pay, write a list
of payments, and settle the whole list with one signature. The money lives on
Tempo — a payments-first Layer 1 where the stablecoin doubles as the gas token.

There is no Pinna account and no server holding funds. Your wallet is the
identity; contacts, lists and requests live in your browser.

---

## What Tempo gives Pinna

Two Tempo features do the heavy lifting:

- **Tempo transactions batch calls.** One transaction can carry many calls, so
  a list of twenty payments is a single signature instead of twenty popups.
- **TIP-20 transfers can carry a 32-byte memo.** Every transfer Pinna sends
  carries a reference, so a payment is also the record of what it was for.

Fees are paid in the same stablecoin you are sending — Tempo has no separate
gas token to hold. Pinna currently pays fees in the token being sent (the
`feeToken` field on the Tempo transaction). Fee sponsorship (`feePayer`) is
documented by Tempo but is not wired up here, because it needs a sponsoring
account to run.

## Networks

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | `4217` | `42431` (Moderato) |
| RPC | `https://rpc.tempo.xyz` | `https://rpc.moderato.tempo.xyz` |
| Explorer | `https://explore.tempo.xyz` | `https://explore.testnet.tempo.xyz` |

**Pinna defaults to the Moderato testnet** so nothing real moves while you
look around. Set `NEXT_PUBLIC_TEMPO_CHAIN=mainnet` to point it at mainnet.

The testnet faucet funds test tokens only — it cannot pay for anything on
mainnet. Real money only exists on chain 4217.

Tokens: `pathUSD` is the mainnet stablecoin (and the faucet token on testnet);
testnet also has `AlphaUSD`.

## How it works

### Send

Add a row per payment — a person, an amount, an optional reason. The same
person can appear on several rows on purpose: Pinna never merges them, so
three $25 rows for Jake are three separate transfers with three separate
references. Review groups them by person (Jake · 3 payments · $75), you sign
once, and Pinna shows the transaction hash plus a PDF receipt.

### Request

A request is money you are owed. After you write the rows you choose, per
request, how it goes out:

- **Pay link** — a public page carrying the whole request in the URL. Whoever
  owes you opens it, connects a wallet, and pays in one tap. The transfer's
  memo is the request id, so the payment matches the request automatically.
- **Draft message** — a ready-to-send chat message with the link.
- **PDF draft** — for sending yourself, with the payee address, amount, reason
  and date.
- **Neither** — the request is a reminder. It still appears under Waiting.

A request stays under Waiting until the app sees a matching transfer on Tempo,
or until you mark it paid yourself.

### History

Three tabs:

- **Money sent / paid by you**
- **Money requested / received by you**
- **Waiting (links not paid / outstanding payments)** — with a button that
  reads Tempo and settles anything that has been paid.

## Matching payments

A transfer settles a request when:

1. it carries a memo whose reference is that request's id — the memo wins, so
   an overpayment or a rounding difference still matches; or
2. it has no memo, but it comes from the person who owes, goes to you, covers
   the amount, and is not older than the request.

Anything else is left alone. Pinna never guesses that a payment is yours.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 45 tests
npm run build
```

### Environment

Names only — values belong in `.env.local`, which is never committed.

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_TEMPO_CHAIN` | `mainnet` to use chain 4217; anything else uses Moderato |
| `NEXT_PUBLIC_TEMPO_RPC` | Override the RPC endpoint |
| `NEXT_PUBLIC_TEMPO_EXPLORER` | Override the explorer base URL |
| `NEXT_PUBLIC_TIP20` | Send a different TIP-20 token address |

No private keys, no server secrets. Signing happens in the browser wallet, and
adding Tempo to a wallet uses `wallet_addEthereumChain` — no key ever leaves
the wallet.

## Tests

The suite covers the parts where a mistake would cost money:

- **Amounts** — parsing, formatting, and exact totals with no floating-point
  drift; grouping rows by person for review while keeping rows separate.
- **Memos** — 32-byte encoding, round-trips, rejection of foreign memos.
- **Batches** — one `transferWithMemo` call per row, decoded back out of the
  ABI to confirm recipient, amount and memo, including two payments to the
  same person staying separate.
- **Requests** — status transitions, and the matching rules for incoming
  transfers (memo match, payer/amount/time match, and the cases that must not
  match).
- **Brand and networks** — the name, the handle, the X link, the five example
  cards, the documented chain ids and endpoints, pay-link round-trips.

## Notes and limits

- Contacts are names you type. Pinna does not resolve identities from chain
  data and never will claim to.
- Requests and history are stored per wallet, in this browser only. Clearing
  site data clears them; the money is unaffected, since it is on Tempo.
- Pinna reads Tempo through the public RPC to detect payments. If the RPC is
  unreachable, detection waits — nothing is marked paid on a guess.

---

Built by CK · https://x.com/CRYPTFRANI
