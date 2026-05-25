import Link from "next/link";

export const metadata = {
  title: "Team Scheduling and Photographer Management — Kyoria OS",
  description:
    "See every photographer's availability in real time, assign jobs in seconds, and dispatch your team without spreadsheets. Kyoria OS handles team scheduling so you can focus on growing your business.",
};

const FEATURES = [
  "See every photographer's real-time availability from one dashboard",
  "Assign jobs to team members with a single click",
  "Google Calendar sync keeps availability always current",
  "Automated assignment notifications via email and SMS",
  "Photographer-specific booking pages for direct client scheduling",
  "Time blocks and unavailability management per team member",
  "Role-based permissions — photographers see only their own jobs",
  "Dispatch history and job tracking per team member",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/booking-scheduling", label: "Booking and Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/client-portal", label: "Client and Agent Portal" },
  { href: "/features/payments-automation", label: "Payments and Automation" },
  { href: "/features/service-areas", label: "Service Areas" },
];

export default function TeamManagementPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Team Management</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Schedule Your Team Without the Spreadsheets
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            See every photographer's availability in real time, assign jobs in seconds, and let the platform handle the notifications. Your team always knows where to be and when.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm text-center"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-block border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-sm text-center"
            >
              Sign in to your account
            </Link>
          </div>
          <p className="text-white/25 text-xs mt-4">From $159/month &middot; No contracts &middot; Cancel anytime</p>
        </div>
      </section>

      {/* FEATURES LIST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Full visibility over your team, every day.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              Stop texting photographers to check availability. Kyoria OS shows you who is free, who is booked, and who syncs with Google Calendar in real time.
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

          {/* Team schedule mockup */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Team Availability — Today</p>
              <span className="text-[9px] text-navy bg-navy/5 border border-navy/10 px-2 py-0.5 rounded-full font-semibold">
                May 29
              </span>
            </div>
            <div className="space-y-3">
              {[
                { name: "Jordan M.", status: "Available", badge: "text-emerald-700 bg-emerald-50 border-emerald-100", job: null },
                { name: "Alex R.", status: "Booked 10am", badge: "text-amber-600 bg-amber-50 border-amber-100", job: "2847 Coastal Ridge Dr" },
                { name: "Sam T.", status: "Available", badge: "text-emerald-700 bg-emerald-50 border-emerald-100", job: null },
                { name: "Morgan K.", status: "Day off", badge: "text-gray-400 bg-gray-50 border-gray-200", job: null },
              ].map((m) => (
                <div key={m.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-navy">{m.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{m.name}</p>
                    {m.job && <p className="text-[10px] text-gray-400 truncate">{m.job}</p>}
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${m.badge}`}>
                    {m.status}
                  </span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
              title: "Real-time availability",
              desc: "Google Calendar sync keeps each photographer's schedule current. No manual updates required.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ),
              title: "One-click assignment",
              desc: "Assign a job to any available photographer instantly. They get notified automatically by email and SMS.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
              title: "Role-based access",
              desc: "Photographers see only their own jobs. Managers see the full team. Everyone works from the same system.",
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Build your team</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Stop managing your team in texts and spreadsheets.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Add your photographers, connect Google Calendar, and start dispatching jobs in minutes.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Get Started
          </Link>
          <p className="text-white/25 text-xs mt-4">No contract &middot; Cancel anytime</p>
        </div>
      </section>

      {/* BLOG LINKS */}
      <section className="bg-cream py-12 px-6 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-5 font-semibold text-center">Related reading</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/blog/how-photography-teams-manage-scheduling-delivery" className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors bg-white">
              How top photography teams manage scheduling and delivery
            </Link>
            <Link href="/blog/why-photographers-leaving-multiple-tools" className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors bg-white">
              Why photographers are moving away from multiple tools
            </Link>
          </div>
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
