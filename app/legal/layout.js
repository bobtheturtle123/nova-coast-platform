import Link from "next/link";

export default function LegalLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            KyoriaOS
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/legal/cookies" className="hover:text-gray-600 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12">
        {children}
      </main>
      <footer className="border-t border-gray-100 mt-16 py-6">
        <div className="max-w-3xl mx-auto px-4 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} KyoriaOS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
