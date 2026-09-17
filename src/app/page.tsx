import Link from "next/link";
import { Fern } from "@/components/Fern";
import { EXAMPLE_CARDS, TEMPO_COPY } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="fade-in">
      {/* Masthead */}
      <section className="shell" style={{ paddingTop: 72, paddingBottom: 8 }}>
        <div
          style={{
            display: "grid",
            gap: 40,
            gridTemplateColumns: "minmax(0, 1fr)",
            alignItems: "start",
          }}
          className="masthead"
        >
          <div>
            <p className="eyebrow" style={{ margin: "0 0 22px" }}>
              Pinna · on Tempo
            </p>
            <h1
              className="display"
              style={{ fontSize: "clamp(2.6rem, 6.2vw, 4.6rem)", margin: "0 0 26px", maxWidth: "17ch" }}
            >
              Names and reminders.
              <br />
              <em style={{ color: "var(--sage)" }}>Dollars move on Tempo.</em>
            </h1>
            <p className="muted" style={{ fontSize: "1.1rem", maxWidth: "52ch", margin: "0 0 34px" }}>
              Pinna keeps the list of who you pay, writes the reason on every transfer, and
              settles the whole list in a single signature. The money lives on Tempo.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link className="button" href="/send">
                Send
              </Link>
              <Link className="button button-quiet" href="/request">
                Request
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ opacity: 0.9 }}>
              <Fern size={132} />
            </div>
          </div>
        </div>
      </section>

      {/* Tempo, plainly */}
      <section className="shell" style={{ marginTop: 84 }}>
        <hr className="rule" />
        <div
          className="two-col"
          style={{ display: "grid", gap: 36, gridTemplateColumns: "minmax(0,1fr)", padding: "40px 0" }}
        >
          <div>
            <p className="eyebrow" style={{ margin: "0 0 14px" }}>
              What Tempo is
            </p>
            <p className="muted" style={{ margin: 0, maxWidth: "46ch" }}>
              {TEMPO_COPY.what}
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 14px" }}>
              What Tempo does inside Pinna
            </p>
            <p className="muted" style={{ margin: 0, maxWidth: "46ch" }}>
              {TEMPO_COPY.inPinna}
            </p>
          </div>
        </div>
        <hr className="rule" />
      </section>

      {/* How Pinna works */}
      <section className="shell" style={{ paddingTop: 56 }}>
        <p className="eyebrow" style={{ margin: "0 0 30px" }}>
          How Pinna works
        </p>
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 0,
            gridTemplateColumns: "minmax(0,1fr)",
          }}
          className="steps"
        >
          {TEMPO_COPY.steps.map((step, i) => (
            <li
              key={step}
              style={{
                display: "grid",
                gridTemplateColumns: "64px minmax(0,1fr)",
                alignItems: "baseline",
                padding: "20px 0",
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <span className="display faint" style={{ fontSize: "1.6rem" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: "1.05rem" }}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Example cards */}
      <section className="shell" style={{ paddingTop: 64 }}>
        <p className="eyebrow" style={{ margin: "0 0 8px" }}>
          What people use it for
        </p>
        <div className="examples">
          {EXAMPLE_CARDS.map((card) => (
            <article key={card.title} className="example-card">
              <h2 className="display" style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>
                {card.title}
              </h2>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: "0.97rem" }}>
                {card.body}
              </p>
              <p className="faint" style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.04em" }}>
                {card.people.join(" · ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="shell" style={{ paddingTop: 80, textAlign: "center" }}>
        <p className="display" style={{ fontSize: "clamp(1.5rem, 3.4vw, 2.4rem)", margin: "0 0 26px" }}>
          Write the list. Sign once.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="button" href="/send">
            Send a list
          </Link>
          <Link className="button button-quiet" href="/request">
            Request money
          </Link>
        </div>
      </section>

      <style>{`
        @media (min-width: 900px) {
          .masthead { grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr) !important; }
          .two-col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 64px !important; }
          .steps { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 64px !important; }
        }
      `}</style>
    </div>
  );
}
