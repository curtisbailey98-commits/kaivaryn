import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "Kaivaryn — Recover Revenue. Eliminate Operational Waste.",
    template: "%s | Kaivaryn",
  },
  description:
    "Kaivaryn LLC provides enterprise AI consulting for revenue recovery and operations efficiency. Disciplined analysis. Measurable outcomes.",
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  openGraph: {
    title: "Kaivaryn",
    description: "Recover Revenue. Eliminate Operational Waste.",
    type: "website",
  },
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
