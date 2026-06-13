import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

export const metadata = {
  metadataBase: new URL("https://kyoriaos.com"),
  title: "KyoriaOS: Business software for real estate photographers",
  description: "Booking, payments, and media delivery built for real estate photography businesses.",
  alternates: { canonical: "https://kyoriaos.com" },
  manifest: "/manifest.json",
  // Explicitly mark the site indexable — zero ambiguity for crawlers.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  keywords: [
    "real estate photography software",
    "real estate media business software",
    "photography booking software",
    "gallery delivery software",
    "real estate photographer CRM",
    "KyoriaOS",
  ],
  openGraph: {
    type: "website",
    siteName: "KyoriaOS",
    url: "https://kyoriaos.com",
    title: "KyoriaOS: The complete system for real estate media businesses",
    description: "Booking, scheduling, gallery delivery, and payments — all connected. KyoriaOS replaces the tools real estate photographers patch together.",
    images: [{ url: "/kyoriaos-logo.png", width: 1200, height: 630, alt: "KyoriaOS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KyoriaOS: The complete system for real estate media businesses",
    description: "Booking, scheduling, gallery delivery, and payments — all connected.",
    images: ["/kyoriaos-logo.png"],
  },
  icons: {
    icon: [{ url: "/kyoriaos-logo.png", type: "image/png" }],
    apple: "/kyoriaos-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KyoriaOS",
  },
};

export const viewport = {
  themeColor: "#0F172A",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
