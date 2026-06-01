// Auth pages must never appear in search results.
// noindex here + removing /auth/ from robots.txt disallow lets Googlebot
// crawl the page, read this tag, and deindex any previously indexed URLs.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return children;
}
