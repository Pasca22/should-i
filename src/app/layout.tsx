import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Should I?",
  description: "Ask Jev whether the weather is right for your run.",
};

export const viewport: Viewport = {
  themeColor: "#08191a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        {children}
        {/* Vercel Web Analytics (cookieless page views) and Speed Insights (real-user Core Web Vitals).
            They only send data on Vercel deployments where they're enabled in the dashboard. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
