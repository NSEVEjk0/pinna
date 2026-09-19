# Pinna

**Pay a list, request money, and keep every receipt — on Tempo.**

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

Add a row per payment — a person, an amount, an optional reason — or tap
**Contacts** beside the name to pick someone you already know. The same person
can appear on several rows on purpose: Pinna never merges them, so three $25
rows for Jake are three separate transfers with three separate references.
Every amount must be above zero, however small.

Review groups them by person (Jake · 3 payments · $75), you sign once, and
Pinna shows the transaction hash plus a PDF receipt.

### Request

A request is money you are owed. Your name goes on it — Pinna asks for it the
first time you connect, and you can change it for an individual request while
you write it — so the link opens with "Hey, it's me Jake. I'm requesting
payment for dinner."

After you write the rows you choose, per request, how it goes out:

- **Pay link** — a public page carrying the whole request in the URL. Whoever
  owes you opens it, connects a wallet, and pays in one tap. The transfer's
  memo is the request id, so the payment matches the request automatically.
- **Draft message** — a ready-to-send chat message with the link.
- **PDF draft** — for sending yourself, set in Pinna's own palette.
- **Neither** — the request is a reminder. It still appears under Waiting,
  and you can copy a reminder message or attach a pay link to it later.

A request stays under Waiting until the app sees a matching transfer on Tempo,
or until you mark it paid yourself. Any request can be **cancelled** while it
is still waiting, and cancelled ones stay listed so you can reopen them.

When someone pays through a link they get a checkmark, the transaction hash, a
PDF receipt, and a **confirmation message** they can send straight back —
"I have completed payment for what was in the request", with the reference and
the transaction link in it.

### Sync across devices

Contacts, requests and lists live in the browser by default. On `/sync` you can
also keep a copy on the server, addressed by your Tempo wallet — no password,
no account: connecting the wallet is what claims the data.

- **No keys leave the wallet.** The server stores a blob and hands it back; it
  can never sign anything.
- **Encrypted in the browser.** With encryption on, the blob is sealed with a
  key derived from a wallet signature (no transaction, no fee), so the server
  keeps something it cannot read — names included.
- **Merging never deletes.** Saving and loading combine both sides by identity
  — contacts by address, requests and lists by id — keeping the newest of each,
  and preferring a settled request over a waiting one.

It needs `TURSO_DATABASE_URL` (and `TURSO_AUTH_TOKEN`) on the deployment; until
those are set the sync page says so plainly rather than pretending.

### Agents can pay a request (MPP 402)

The same request a person opens also answers a machine:

```
GET  /api/pay/{id}?d={payload}            -> 402 challenge, or 200 if already paid
POST /api/pay/{id}?d={payload} {txHash}   -> 200 with a Payment-Receipt header
```

Ask without paying and the route replies **402** with the amount, token, chain,
recipient and the reference that must go in the memo. Send the transfer on
Tempo, present its hash (body or `X-Payment`), and the route reads the chain
itself and returns the verified facts plus a signed `Payment-Receipt`. A hash
that does not match, or a reference that has not been paid, gets 402 again — it
is never taken on trust.

### Link expiry

A request can stay open for ever or close on a date you choose (24 hours, 7
days, 30 days, or a specific day). After that the link stops offering payment
and says so; a transfer that still carries the reference is recognised either
way, so a late payment is never lost.

### History

Three tabs:

- **Money sent / paid by you**
- **Money requested / received by you**
- **Waiting (links not paid / outstanding payments)** — with a button that
  reads Tempo and settles anything that has been paid.

Every row opens. A sent list shows the batch: the transaction hash, the
network, when it finalised, every name with its amount and reason, and a
**Redownload PDF** button. A request shows its amount, reason, creation time,
finalisation time, how it settled, its reference, and its full transaction
hash — with cancel and mark-paid while it is still waiting.

Above the tabs, **Repeated payments** lists anyone paid the same amount more
than once, with the count and the running total — so an accidental hundredth
payment is impossible to miss.

## Payment tokens

Switch the stablecoin from the header, beside the wallet. Tempo charges the fee
in whichever token you are sending, so there is nothing to swap first. Testnet
offers `pathUSD` and `AlphaUSD`; mainnet settles in `pathUSD`.

## Contacts

Contacts are names you type, optionally with a picture — the image is shrunk in
the browser before it is kept, so nothing is uploaded anywhere. Tap a contact
to send to them or request from them, and use the ▾ button beside any name
field to pick from the list instead of typing an address.

## Notifications

A notifications section keeps a short local log: payments that arrived, lists
you sent, requests you created. Unread ones are counted in the header, and the
count clears when you open the page. Requests that get paid show up there with
their transaction hash.

## Automation

`/automation` holds two things:

1. **Scheduled payments.** Daily, weekly, monthly or yearly, at a time of day
   you choose, each with its own note written into the transfer memo. When a run
   comes due and Pinna is open it appears ready to sign.
2. **An agent that pays for you — under development.** A future version gives
   Pinna a Tempo (or x402) account it can operate itself, so payments can go out
   on a schedule or when a milestone is reached, within limits you set. It is
   not built, and the page says so rather than implying otherwise.

Pinna holds no keys and runs no server, so nothing is ever sent without your
wallet signing it.

## Navigation

Every screen except the home screen has a back control in the top corner. The
header carries the network switch — mainnet or testnet — right beside the
wallet, so you always know which Tempo chain the money is on.

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
npm test         # 58 tests
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
| `TURSO_DATABASE_URL` | Cloud sync database (unset = sync off) |
| `TURSO_AUTH_TOKEN` | Cloud sync credentials |

No private keys, no server secrets. Signing happens in the browser wallet, and
adding Tempo to a wallet uses `wallet_addEthereumChain` — no key ever leaves
the wallet.

## Tests

The suite covers the parts where a mistake would cost money:

- **Amounts** — parsing, formatting, and exact totals with no floating-point
  drift; grouping rows by person for review while keeping rows separate; and
  that only an amount above zero counts as a payment.
- **Memos** — 32-byte encoding, round-trips, rejection of foreign memos.
- **Batches** — one `transferWithMemo` call per row, decoded back out of the
  ABI to confirm recipient, amount and memo, including two payments to the
  same person staying separate.
- **Requests** — status transitions (including cancellation), and the matching
  rules for incoming transfers (memo match, payer/amount/time match, and the
  cases that must not match).
- **Repeats** — detecting the same person paid the same amount again and
  again, right up to a hundred times.
- **Messages** — the greeting on a request, the reminder for linkless
  requests, and the confirmation a payer sends back.
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

## Running it on a server

`scripts/screen-start.sh` builds (if needed) and serves the app inside a
screen session named `pinna`, with the server in one window and a log tail in
another:

```bash
bash scripts/screen-start.sh 3001
screen -r pinna
```
