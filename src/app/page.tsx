import Link from "next/link";
import { Fern } from "@/components/Fern";
import { EXAMPLE_CARDS, FEATURES, HIGHLIGHTS, HOW_IT_WORKS, TEMPO_COPY } from "@/lib/brand";
import { FaqSection } from "@/components/Faq";

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
              style={{ fontSize: "clamp(2.6rem, 6.2vw, 4.6rem)", margin: "0 0 26px", maxWidth: "22ch" }}
            >
              Pay a list, request money,
              <br />
              <em style={{ color: "var(--sage)" }}>and keep every receipt.</em>
            </h1>
            <p className="muted" style={{ fontSize: "1.1rem", maxWidth: "52ch", margin: "0 0 34px" }}>
              Pinna is a contact list that pays. Write down who you pay and what each payment is
              for, then settle the whole list with one signature — or send a link and let people
              pay you. Every transfer lands on Tempo with its reason written in, so your records
              explain themselves.
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
              What is Tempo?
            </p>
            <p className="muted" style={{ margin: 0, maxWidth: "46ch" }}>
              {TEMPO_COPY.what}
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 14px" }}>
              What is Pinna?
            </p>
            <p className="muted" style={{ margin: 0, maxWidth: "52ch" }}>
              {TEMPO_COPY.goal}
            </p>
          </div>
        </div>
        <hr className="rule" />
      </section>

      {/* Selling points */}
      <section className="shell" style={{ paddingTop: 56 }}>
        <p className="eyebrow" style={{ margin: "0 0 8px" }}>
          Why Pinna
        </p>
        <div className="features">
          {HIGHLIGHTS.map((item) => (
            <article key={item.title} className="feature-item">
              <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 550 }}>{item.title}</h3>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.94rem" }}>
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Example cards */}
      <section className="shell" style={{ paddingTop: 64 }}>
        <p className="eyebrow" style={{ margin: "0 0 8px" }}>
          Example use cases
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

      {/* How Pinna works, and everything it does */}
      <section className="shell" style={{ paddingTop: 72 }}>
        <hr className="rule" />
        <p className="eyebrow" style={{ margin: "32px 0 4px" }}>
          How Pinna works
        </p>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)", margin: "0 0 28px" }}>
          From each side of the money.
        </h2>
        <div
          className="how-grid"
          style={{ display: "grid", gap: 36, gridTemplateColumns: "minmax(0,1fr)" }}
        >
          {HOW_IT_WORKS.map((group) => (
            <article
              key={group.title}
              style={{ borderTop: "1px solid var(--hairline)", paddingTop: 20 }}
            >
              <h3 className="display" style={{ fontSize: "1.45rem", margin: "0 0 6px" }}>
                {group.title}
              </h3>
              <p className="faint" style={{ margin: "0 0 14px", fontSize: "0.86rem" }}>
                {group.summary}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
                {group.points.map((point) => (
                  <li key={point} className="muted" style={{ fontSize: "0.94rem" }}>
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="eyebrow" style={{ margin: "56px 0 4px" }}>
          Features
        </p>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)", margin: "0 0 8px" }}>
          Everything Pinna does, in plain words.
        </h2>
        <div className="features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-item">
              <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 550 }}>{feature.title}</h3>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.94rem" }}>
                {feature.body}
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

      <FaqSection />

      <style>{`
        @media (min-width: 900px) {
          .masthead { grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr) !important; }
          .two-col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 64px !important; }
          .how-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: 64px !important; }
        }
      `}</style>
    </div>
  );
}
