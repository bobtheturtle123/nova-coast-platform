import "./globals.css";

export const metadata = {
  title: "ShootFlow — Real Estate Photography Platform",
  description: "The all-in-one booking, payment, and gallery platform for real estate photographers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
