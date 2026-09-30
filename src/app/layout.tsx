import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";
import { AliasPrompt } from "@/components/AliasPrompt";
import { BRAND } from "@/lib/brand";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK"],
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pinna — pay a list, request money, keep every receipt",
  description: `${BRAND.oneLiner} A contact list that settles a whole list of payments in one signature, writes the reason into every transfer, and reads the record back from the chain.`,
  applicationName: "Pinna",
  keywords: [
    "stablecoin payments",
    "payroll",
    "batch payments",
    "Tempo",
    "TIP-20",
    "invoicing",
    "remittances",
  ],
  openGraph: {
    title: "Pinna — pay a list, request money, keep every receipt",
    description: BRAND.oneLiner,
    siteName: "Pinna",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinna — pay a list, request money, keep every receipt",
    description: BRAND.oneLiner,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://pinna-ckay.vercel.app"
  ),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          <div className="shell">
            {/* Every screen except home gets a way back. */}
            <BackButton />
          </div>
          <main>{children}</main>
          <SiteFooter />
          <AliasPrompt />
        </Providers>
      </body>
    </html>
  );
}
