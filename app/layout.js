import "./globals.css";

export const metadata = {
  title: "Book a Shoot — Nova Coast Media",
  description: "Professional real estate photography, video, and drone services in San Diego.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
