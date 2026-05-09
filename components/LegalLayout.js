import Link from "next/link";

export default function LegalLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-semibold text-[#0F172A] text-base tracking-tight">Kyoria<span className="text-[#3486cf]">OS</span></span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/terms"   className="hover:text-[#3486cf] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[#3486cf] transition-colors">Privacy</Link>
            <Link href="/cookies" className="hover:text-[#3486cf] transition-colors">Cookies</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-gray-100 bg-[#F8F9FC]">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-xs font-semibold text-[#3486cf] uppercase tracking-widest mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 py-12 prose-legal">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-[#F8F9FC]">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} KyoriaOS. All rights reserved.</p>
          <nav className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/terms"   className="hover:text-[#3486cf] transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-[#3486cf] transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="hover:text-[#3486cf] transition-colors">Cookie Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* Inline prose styles injected via a global class — add to globals.css if not present */
export function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-bold text-[#0F172A] mb-3 pb-2 border-b border-gray-100">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export function Sub({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-[#0F172A] mb-1.5">{title}</h3>
      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

export function Ul({ items }) {
  return (
    <ul className="list-disc list-inside space-y-1 pl-1 text-sm text-gray-700">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export function Callout({ children }) {
  return (
    <div className="bg-[#3486cf]/5 border border-[#3486cf]/20 rounded-xl px-5 py-4 text-sm text-[#0F172A]">
      {children}
    </div>
  );
}
