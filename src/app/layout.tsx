import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { RoleBasedNavigation } from "@/components/RoleBasedNavigation";
import { AuthProvider } from "@/components/AuthProvider";
import GlobalLoadingShield from "@/components/GlobalLoadingShield";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MainLayout from "@/components/MainLayout";

const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://cadonce.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "CADONCE | CAD Project Management & Organization Dashboard",
    template: "%s | CADONCE"
  },
  description: "High-performance project management for professional CAD organizations. Featuring real-time viewports, client CRM, and automated designer payouts.",
  keywords: [
    "CAD project management",
    "engineering organization dashboard",
    "CAD workflow automation",
    "designer tracking",
    "engineering CRM",
    "CAD viewport feedback",
    "project management for engineers"
  ],
  authors: [{ name: "Stitch Spectrum" }],
  creator: "Stitch Spectrum",
  publisher: "Stitch Spectrum",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "CADONCE",
    title: "CADONCE | Professional CAD Organization Management",
    description: "The all-in-one workspace for CAD organizations to manage projects, clients, and teams with precision.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CADONCE Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CADONCE | CAD Project Management Dashboard",
    description: "High-performance project management for professional CAD agencies.",
    images: ["/og-image.png"],
    creator: "@cadonce",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body
        className={`${plusJakartaSans.variable} ${inter.variable} font-body bg-background text-on-surface antialiased min-h-full`}
      >
        <GoogleAnalytics ga_id={gaId} />
        <AuthProvider>
          <GlobalLoadingShield>
            <RoleBasedNavigation />
            <MainLayout>
              {children}
            </MainLayout>
          </GlobalLoadingShield>
        </AuthProvider>
      </body>
    </html>
  );
}
