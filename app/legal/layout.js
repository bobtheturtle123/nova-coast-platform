import Link from "next/link";

export default function LegalLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            KyoriaOS
          </Link>
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap justify-end">
            <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link href="/legal/sms-consent" className="hover:text-gray-600 transition-colors">SMS Consent</Link>
            <Link href="/legal/cookies" className="hover:text-gray-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12">
        {children}
      </main>
      <footer className="border-t border-gray-100 mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} KyoriaOS · Rick Ryan Photography LLC</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
            <Link href="/legal/sms-consent" className="hover:text-gray-600 transition-colors">SMS Consent</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
