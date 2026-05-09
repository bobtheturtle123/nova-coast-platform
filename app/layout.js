import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://app.kyoriaos.com"),
  title: "KyoriaOS: Business software for real estate photographers",
  description: "Booking, payments, and media delivery built for real estate photography businesses.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KyoriaOS",
  },
  themeColor: "#0F172A",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
