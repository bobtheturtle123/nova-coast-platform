import Link from "next/link";

export const metadata = {
  title: "Payments and Automation for Real Estate Photographers — KyoriaOS",
  description:
    "Collect deposits at booking, lock galleries behind balance payments, and send automated reminders. KyoriaOS handles every payment touchpoint so you stop chasing clients.",
  alternates: { canonical: "https://kyoriaos.com/features/payments-automation" },
};

const FEATURES = [
  "Deposit collected at the time of booking — before you schedule the shoot",
  "Gallery locked until balance payment clears through Stripe",
  "Automated shoot reminders sent to clients and photographers by SMS and email",
  "Revenue tracking per listing so you know exactly what each job made",
  "Promo codes and seasonal discount tools built into the booking flow",
  "Payment history and outstanding balances visible from the dashboard",
  "Stripe Connect integration — payments go directly to your account",
  "Service agreement capture built into the checkout flow",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/booking", label: "Booking and Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/team-scheduling", label: "Team Management" },
  { href: "/features/agent-portal", label: "Agent Portal" },
  { href: "/features/service-areas", label: "Service Areas" },
];

export default function PaymentsAutomationPage() {
  return (
    <div>

      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/features" className="text-white/40 text-xs hover:text-white/65 transition-colors">
              &larr; All Features
            </Link>
          </div>
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Payments and Automation</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Get Paid Without Chasing Anyone
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            KyoriaOS collects your deposit at booking, locks the gallery until the balance clears, and sends every reminder automatically. You focus on the shoot. The platform handles the money.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm text-center"
            >
              Start Today
            </Link>
            <Link
              href="/auth/login"
              className="inline-block border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-sm text-center"
            >
              Sign in to your account
            </Link>
          </div>
          <p className="text-white/25 text-xs mt-4">From $79/month &middot; No contracts &middot; Cancel anytime</p>
        </div>
      </section>

      {/* FEATURES LIST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Every payment touchpoint, automated.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              From the first deposit to the final download, KyoriaOS handles every financial step in the job cycle. No manual invoices. No follow-up texts. No unpaid balances sitting in your inbox.
            </p>
            <ul className="space-y-3">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Revenue mockup */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">This Month</p>
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                +18% vs last month
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Revenue",  value: "$8,240", color: "text-navy" },
                { label: "Jobs",     value: "34",     color: "text-gray-700" },
                { label: "Pending",  value: "$1,180", color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { addr: "1842 Ocean View Dr",       amount: "$299", status: "Paid",    badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { addr: "905 Harbor Blvd, Del Mar",  amount: "$449", status: "Pending", badge: "text-amber-600 bg-amber-50 border-amber-100" },
                { addr: "221 Coast Hwy, Encinitas",  amount: "$199", status: "Paid",    badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
              ].map((r) => (
                <div key={r.addr} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <p className="flex-1 text-xs text-gray-600 truncate">{r.addr}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${r.badge}`}>{r.status}</span>
                  <p className="text-xs font-bold text-gray-900 w-10 text-right flex-shrink-0">{r.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THREE-COLUMN CALLOUT */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              ),
              title: "Deposit at booking",
              desc: "Clients pay a deposit as part of the booking flow. No shoot gets scheduled without it.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
              title: "Balance before download",
              desc: "The gallery stays locked until Stripe confirms the remaining balance. You never deliver before you are paid.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ),
              title: "Automated reminders",
              desc: "Shoot reminders go to clients and photographers by SMS and email. You never need to follow up manually.",
            },
          ].map((c) => (
            <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="w-10 h-10 bg-navy/5 border border-navy/10 rounded-xl flex items-center justify-center mb-4 text-navy">
                {c.icon}
              </div>
              <h3 className="font-semibold text-navy text-sm mb-2">{c.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Stop chasing payments</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Set it up once. Get paid every time.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Connect Stripe, set your deposit amount, and KyoriaOS handles the rest from the first booking to the final download.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Start Today
          </Link>
          <p className="text-white/25 text-xs mt-4">No contract &middot; Cancel anytime</p>
        </div>
      </section>

      {/* OTHER FEATURES NAV */}
      <section className="bg-white py-10 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-5 font-semibold text-center">Explore more features</p>
          <div className="flex flex-wrap justify-center gap-3">
            {OTHER_FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
