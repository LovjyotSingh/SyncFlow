import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: "SyncFlow: write together, in sync", template: "%s · SyncFlow" },
  description:
    "A real-time collaborative workspace. Edit the same page with your team, see live cursors, share by link, and drop files right onto the page.",
  openGraph: {
    title: "SyncFlow: write together, in sync",
    description: "Real-time collaborative pages with live cursors, share links and files. Built by Lovjyot Singh.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#111113",
              border: "1px solid rgb(255 255 255 / 0.14)",
              color: "#f5f5f7",
              fontFamily: "var(--font-geist)",
            },
          }}
        />
      </body>
    </html>
  );
}
