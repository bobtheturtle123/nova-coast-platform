import Link from "next/link";

// Shared chrome for every /guides/* page so they look consistent and cross-link.
export const ALL_GUIDES = [
  { slug: "getting-started", icon: "🚀", title: "How KyoriaOS works",        blurb: "The whole workflow, start to finish — from a booking to delivered media." },
  { slug: "products",        icon: "🧾", title: "Setting up your services",  blurb: "Build packages, services, and add-ons clients can book." },
  { slug: "listings",        icon: "🏠", title: "Listings explained",        blurb: "What a listing is and the journey from shoot to delivery." },
  { slug: "team-schedule",   icon: "📆", title: "Team & scheduling",         blurb: "Add photographers, sync calendars, and avoid double-booking." },
  { slug: "zapier",          icon: "🔗", title: "Connect other apps (Zapier)", blurb: "Send bookings to Google Sheets, Slack, your CRM, and more." },
];

export default function GuideShell({ eyebrow = "Guide", title, intro, currentSlug, children }) {
  const others = ALL_GUIDES.filter((g) => g.slug !== currentSlug);
  return (
    <main style={{ background: "#F7F8FA", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/guides" className="text-sm text-[#3486cf] hover:underline">← All guides</Link>

        <div className="mt-6 mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3486cf]">{eyebrow}</span>
          <h1 className="font-display text-4xl text-[#0F172A] mt-2 leading-tight">{title}</h1>
          {intro && <p className="text-gray-500 mt-3 text-lg leading-relaxed">{intro}</p>}
        </div>

        {children}

        {/* Cross-links */}
        <div className="mt-14 pt-10 border-t border-gray-200">
          <h2 className="font-display text-2xl text-[#0F172A] mb-5">Keep learning</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {others.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#3486cf]/40 transition-colors block">
                <div className="text-2xl mb-2">{g.icon}</div>
                <p className="font-semibold text-[#0F172A] text-sm">{g.title}</p>
                <p className="text-[13px] text-gray-500 mt-1 leading-snug">{g.blurb}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 bg-[#0F172A] rounded-2xl p-8 text-center">
          <p className="text-white text-lg font-semibold mb-1">Ready to get started?</p>
          <p className="text-white/60 text-sm mb-5">Set up your studio in minutes and take your first booking.</p>
          <Link href="/auth/register"
            className="inline-block bg-white text-[#0F172A] font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
            Start free →
          </Link>
        </div>
      </div>
    </main>
  );
}

// Reusable numbered-step list.
export function Steps({ steps }) {
  return (
    <div className="space-y-4">
      {steps.map((s, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4">
          <div className="w-9 h-9 rounded-full bg-[#3486cf] text-white font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
          <div>
            <p className="font-semibold text-[#0F172A]">{s.title}</p>
            <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Reusable section heading.
export function GuideH2({ children }) {
  return <h2 className="font-display text-2xl text-[#0F172A] mb-6 mt-12 first:mt-0">{children}</h2>;
}
