import type { Metadata } from "next";
import { Suspense } from "react";

import "@/app/globals.css";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "tarteel.tv",
    template: "%s | tarteel.tv",
  },
  description: "Experience the beauty of Quranic recitations through curated clips and reels.",
  keywords: ["Quran", "Recitation", "Tarteel", "Islamic Clips", "Quran Reels"],
  authors: [{ name: "tarteel.tv" }],
  creator: "tarteel.tv",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tarteel.tv",
    title: "tarteel.tv",
    description: "Experience the beauty of Quranic recitations through curated clips and reels.",
    siteName: "tarteel.tv",
  },
  twitter: {
    card: "summary_large_image",
    title: "tarteel.tv",
    description: "Experience the beauty of Quranic recitations through curated clips and reels.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Suspense fallback={<div className="h-14 border-b bg-background" />}>
            <Header />
          </Suspense>
          <main className="container">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

