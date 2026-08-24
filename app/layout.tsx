import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "UMTennis — ATP Match Predictions",
  description: "Upcoming ATP matches, UMTennis Elo rankings and leakage-free pre-match win probabilities.",
  openGraph: {
    title: "UMTennis — ATP Match Predictions",
    description: "ATP match predictions powered by Elo, surface form and machine learning.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "UMTennis — ATP Match Predictions",
    description: "ATP match predictions powered by Elo, surface form and machine learning.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
