import Link from "next/link";

export default function MarketingShell({ children }) {
  return (
    <div className="min-h-screen bg-white font-body">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-8 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="/#how-it-works" className="hover:text-navy transition-colors">
              How it works
            </a>
            <Link href="/features" className="hover:text-navy transition-colors">
              Features
            </Link>
            <a href="/#pricing" className="hover:text-navy transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-gray-600 hover:text-navy px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="text-sm bg-navy text-white px-4 py-2 rounded-xl hover:bg-navy/90 transition-colors font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main>{children}</main>

      {/* FOOTER */}
      <footer className="bg-navy border-t border-white/10 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div>
              <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-7 w-auto object-contain mb-3 brightness-0 invert" />
              <p className="text-white/35 text-xs max-w-xs leading-relaxed">
                The complete operating system for real estate photography businesses.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div>
                <p className="text-white/60 font-semibold uppercase tracking-widest mb-3 text-[10px]">Features</p>
                <ul className="space-y-2">
                  <li><Link href="/features/booking" className="text-white/35 hover:text-white/65 transition-colors">Booking &amp; Payments</Link></li>
                  <li><Link href="/features/team-scheduling" className="text-white/35 hover:text-white/65 transition-colors">Team Scheduling</Link></li>
                  <li><Link href="/features/gallery-delivery" className="text-white/35 hover:text-white/65 transition-colors">Gallery Delivery</Link></li>
                  <li><Link href="/features/service-areas" className="text-white/35 hover:text-white/65 transition-colors">Service Areas</Link></li>
                  <li><Link href="/features/client-crm" className="text-white/35 hover:text-white/65 transition-colors">Client &amp; Agent CRM</Link></li>
                  <li><Link href="/features/agent-portal" className="text-white/35 hover:text-white/65 transition-colors">Agent Portal</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white/60 font-semibold uppercase tracking-widest mb-3 text-[10px]">Compare</p>
                <ul className="space-y-2">
                  <li><Link href="/vs/honeybook" className="text-white/35 hover:text-white/65 transition-colors">vs HoneyBook</Link></li>
                  <li><Link href="/vs/sprout-studio" className="text-white/35 hover:text-white/65 transition-colors">vs Sprout Studio</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white/60 font-semibold uppercase tracking-widest mb-3 text-[10px]">Legal</p>
                <ul className="space-y-2">
                  <li><a href="/privacy" className="text-white/35 hover:text-white/65 transition-colors">Privacy Policy</a></li>
                  <li><a href="/terms" className="text-white/35 hover:text-white/65 transition-colors">Terms of Service</a></li>
                  <li><a href="/sms-consent" className="text-white/35 hover:text-white/65 transition-colors">SMS Consent</a></li>
                  <li><a href="mailto:contact@kyoriaos.com" className="text-white/35 hover:text-white/65 transition-colors">Support</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-white/25 text-xs">
            <span>&copy; {new Date().getFullYear()} KyoriaOS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
