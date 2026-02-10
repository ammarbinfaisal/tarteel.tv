import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";

import "@/app/globals.css";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import NuqsProvider from "@/components/NuqsProvider.client";
import { Toaster } from "sonner";

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://tarteel.tv'),
  title: {
    default: "tarteel.tv",
    template: "%s | tarteel.tv",
  },
  description: "Clips of Quran Recitations.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "tarteel.tv",
  },
  keywords: ["Quran", "Recitation", "Tarteel", "Islamic Clips", "Quran Reels"],
  authors: [{ name: "tarteel.tv" }],
  creator: "tarteel.tv",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tarteel.tv",
    title: "tarteel.tv",
    description: "Clips of Quran Recitations.",
    siteName: "tarteel.tv",
    images: [
      {
        url: "/image.jpg",
        width: 1200,
        height: 630,
        alt: "tarteel.tv",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "tarteel.tv",
    description: "Clips of Quran Recitations.",
    images: ["/image.jpg"],
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NM6Z6SHFG3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            window.gtag = function(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-NM6Z6SHFG3');
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <NuqsProvider>
            <Suspense fallback={<div className="h-14 border-b bg-background" />}>
              <Header />
            </Suspense>
            <main>{children}</main>
            <Toaster />
          </NuqsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
