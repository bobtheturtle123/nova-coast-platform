import Link from "next/link";

export const metadata = {
  title: "Real Estate Photographer CRM — KyoriaOS Client Management Software",
  description:
    "KyoriaOS is the best CRM for real estate photographers. Track lifetime revenue per client, group customers by brokerage, see your top agents, and manage your entire book of business in one place.",
};

const FEATURES = [
  "Group customers by brokerage, team, or agent network",
  "Track lifetime revenue per client — know your most valuable accounts",
  "Top customer spotlight shows your highest-revenue agents at a glance",
  "Full booking history per client with order count and revenue totals",
  "Invite clients to the Agent Portal with one click",
  "Search and filter your customer list by name, brokerage, or revenue",
  "Order count tracking shows booking frequency per client",
  "Automatic revenue attribution links every payment to the right client",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/booking", label: "Booking & Payments" },
  { href: "/features/team-scheduling", label: "Team Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/service-areas", label: "Service Areas" },
  { href: "/features/agent-portal", label: "Agent Portal" },
];

export default function ClientCrmPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Client &amp; Agent CRM</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Client &amp; Agent CRM for Real Estate Photography Businesses
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Know your best clients, track your revenue per agent, and manage your entire book of business — without a spreadsheet in sight.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm text-center"
            >
              Start for free
            </Link>
            <Link
              href="/auth/login"
              className="inline-block border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-sm text-center"
            >
              Sign in to your account
            </Link>
          </div>
          <p className="text-white/25 text-xs mt-4">No credit card required &middot; Live in under an hour</p>
        </div>
      </section>

      {/* FEATURES LIST + SCREENSHOT */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Your entire client base, organized and searchable.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              KyoriaOS builds your CRM automatically as you take bookings. Every client, every order, every dollar — tracked without any manual data entry from you.
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
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-card-raised">
            <img
              src="/screenshots/customers.png"
              alt="KyoriaOS customer CRM view showing top clients and revenue"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl text-navy font-normal">
              Know your business from the inside out.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Who are your best clients?",
                desc: "The top customer spotlight ranks your highest-revenue agents automatically. Know who to call when you want to fill a slow week.",
                icon: (
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
              },
              {
                title: "Which brokerage sends the most work?",
                desc: "Group clients by brokerage or team and see revenue by account. Helps you focus on the relationships that actually move the needle.",
                icon: (
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                title: "When did they last book?",
                desc: "Full booking history per client lets you spot agents who haven't booked in a while and reach out before they go to a competitor.",
                icon: (
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
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
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Your client data is already there — it just needs a home.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Every booking you take in KyoriaOS automatically builds your CRM. No import, no setup, no spreadsheets.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Start for free &rarr;
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
