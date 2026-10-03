import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_DESCRIPTION =
  "Kaivaryn LLC provides executive AI consulting and an operating platform for revenue recovery and operations efficiency. Disciplined analysis. Measurable outcomes.";

export const metadata: Metadata = {
  title: {
    default: "Kaivaryn — Recover Revenue. Eliminate Operational Waste.",
    template: "%s | Kaivaryn",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Kaivaryn",
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  openGraph: {
    title: "Kaivaryn — Recover Revenue. Eliminate Operational Waste.",
    description: SITE_DESCRIPTION,
    siteName: "Kaivaryn",
    type: "website",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaivaryn — Recover Revenue. Eliminate Operational Waste.",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
