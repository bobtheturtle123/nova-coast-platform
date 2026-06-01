import Link from "next/link";

export const metadata = {
  title: "Real Estate Photography Gallery Delivery — KyoriaOS",
  description:
    "Deliver real estate photos, video, floor plans, and 3D tours in one branded link. KyoriaOS payment-gated gallery delivery collects the balance automatically before downloads unlock.",
  alternates: { canonical: "https://kyoriaos.com/features/gallery-delivery" },
};

const FEATURES = [
  "Payment-gated downloads: gallery unlocks automatically when balance clears",
  "Photos, video, floor plans, and 3D tours all delivered in a single link",
  "MLS-ready and print-ready download packages included automatically",
  "Scheduled delivery — drop the gallery at the exact time you choose",
  "Built-in revision request workflow tracked inside the platform",
  "Activity tracking: see who viewed the gallery, what they downloaded, and when",
  "Branded gallery URL with your business name",
  "Clients can re-access the gallery link anytime — no re-sending needed",
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
  { href: "/features/service-areas", label: "Service Areas" },
  { href: "/features/client-crm", label: "Client & Agent CRM" },
  { href: "/features/agent-portal", label: "Agent Portal" },
];

export default function GalleryDeliveryPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Gallery Delivery</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Branded Gallery Delivery with Automatic Payment Collection
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Upload your work, hit send. The gallery stays locked until the balance is paid — no invoice, no follow-up, no Dropbox link. Just one professional link that handles everything.
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
              Every file type, in one beautiful link.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              Stop sending multiple Dropbox folders. KyoriaOS puts your photos, video, floor plan, and 3D tour behind a single branded delivery link — and the balance is collected before any file can be downloaded.
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
              alt="KyoriaOS gallery delivery and client view"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* PAYMENT GATE CALLOUT */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
              title: "Locked until paid",
              desc: "Files remain inaccessible until Stripe confirms the balance payment. You never deliver before you're paid.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
              title: "All media in one place",
              desc: "Photos, video, floor plans, Matterport 3D tours — clients and agents see everything in a single, organized delivery.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ),
              title: "Activity tracking",
              desc: "Know the moment a client or agent views and downloads the gallery. No more wondering if they received it.",
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Stop chasing payments. Start delivering like a pro.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Your first gallery delivery can be live today. Connect Stripe, upload your work, and send the link.
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
