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
  title: "Pinna — names and reminders, dollars on Tempo",
  description: BRAND.oneLiner,
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
