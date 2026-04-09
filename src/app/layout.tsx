import type { Metadata, Viewport } from "next";

import "@/app/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    startupImage: "/apple-touch-icon.png",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
        url: "/og-image.png",
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
    images: ["/og-image.png"],
  },
  alternates: {
    languages: {
      "en": "https://tarteel.tv",
      "x-default": "https://tarteel.tv",
    },
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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
