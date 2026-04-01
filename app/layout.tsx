import type { Metadata } from "next";
import { Geist, Geist_Mono, PT_Serif } from "next/font/google";
import "./globals.css";
import SceneWrapper from "@/components/SceneWrapper";
import Navigation from "@/components/Navigation";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Neural Point Analytica — Elite Software Engineering",
  description:
    "Rapid, elite-tier software engineering for modern companies. From custom GUIs to AI integrations and backend automation — Neural Point Analytica builds the exact digital product to solve your business problem.",
  keywords: ["app development", "B2B", "custom software", "AI development", "vibe coding"],
  icons: {
    icon: "/NPA-transparent.png",
    apple: "/NPA-transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${ptSerif.variable}`}>
      <body>
        <Providers>
          <SceneWrapper />
          <Navigation />
          <main className="page-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
