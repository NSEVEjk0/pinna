"use client";

/**
 * The second half of Automation: an agent-held account that pays by itself.
 * It is not built yet, and this section says so plainly rather than dressing
 * up a placeholder as a feature.
 */
export function AutomationAgentPanel() {
  const plans = [
    {
      title: "An account Pinna can operate",
      body: "A dedicated Tempo account, created for you, whose keys are held for an agent rather than a browser wallet — so payments can leave without you being present.",
    },
    {
      title: "Rules that watch the clock",
      body: "The same daily, weekly, monthly and yearly rhythms, except the agent signs instead of you.",
    },
    {
      title: "Rules that watch events",
      body: "Pay when a milestone is reached or something happens on chain, rather than on a fixed date — an invoice settles, a balance clears, a delivery lands.",
    },
    {
      title: "Limits you set",
      body: "A ceiling per payment, per period, and per recipient, with a record of everything the agent did and a switch to stop it.",
    },
  ];

  return (
    <div className="panel" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Automation · agent
          </p>
          <h2 className="display" style={{ fontSize: "1.6rem", margin: 0 }}>
            An agent that pays for you
          </h2>
        </div>
        <span className="chip chip-sage">Under development</span>
      </div>

      <p className="muted" style={{ margin: "14px 0 20px", maxWidth: "62ch" }}>
        Today a schedule waits for you to sign, because Pinna holds no keys. The next version
        gives Pinna an account it can operate itself — a Tempo account, or an x402 account for
        paying APIs and services — so payments can go out on their own schedule, or when something
        happens. It is not built yet, and nothing here is running.
      </p>

      <div style={{ display: "grid", gap: 16 }} className="detail-grid">
        {plans.map((plan) => (
          <div key={plan.title} style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{plan.title}</p>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>
              {plan.body}
            </p>
          </div>
        ))}
      </div>

      <p className="faint" style={{ margin: "20px 0 0", fontSize: "0.82rem" }}>
        When this ships, the account will be separate from your wallet, its limits will be visible
        here, and it will never be able to spend more than you have allowed.
      </p>
    </div>
  );
}
