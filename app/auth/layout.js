// Auth pages must never appear in search results.
// noindex here + removing /auth/ from robots.txt disallow lets Googlebot
// crawl the page, read this tag, and deindex any previously indexed URLs.
// follow:true so link equity from any inbound links still flows through.
export const metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }) {
  return children;
}
