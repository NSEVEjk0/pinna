import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="hairline" style={{ borderTop: "1px solid var(--hairline)", borderBottom: 0, marginTop: 96 }}>
      <div className="shell" style={{ padding: "40px 0 64px", display: "grid", gap: 18 }}>
        <p className="muted" style={{ margin: 0, maxWidth: "62ch", fontSize: "0.95rem" }}>
          {BRAND.footer}
        </p>
        <p className="faint" style={{ margin: 0, fontSize: "0.85rem" }}>
          {BRAND.builtBy} ·{" "}
          <a className="link" href={BRAND.xUrl} target="_blank" rel="noreferrer">
            {BRAND.xUrl}
          </a>
        </p>
      </div>
    </footer>
  );
}
