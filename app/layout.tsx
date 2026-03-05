import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ActivityTracker from "@/components/ActivityTracker";
import NotificationProvider from "@/components/NotificationProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "LetsGo — Get Paid to Live Your Best Life",
  description:
    "Discover restaurants and activities, earn progressive cash-back rewards for repeat visits. Go. Play. Eat. Get paid to live your best life.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LetsGo",
  },
  openGraph: {
    title: "LetsGo — Get Paid to Live Your Best Life",
    description:
      "Discover restaurants and activities, earn progressive cash-back rewards for repeat visits.",
    siteName: "LetsGo",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ActivityTracker />
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
