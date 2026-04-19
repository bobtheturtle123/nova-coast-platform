import "./globals.css";

export const metadata = {
  title: "ShootFlow: Business software for real estate photographers",
  description: "Booking, payments, and media delivery built for real estate photography businesses.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
