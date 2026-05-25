import Link from "next/link";

export const metadata = {
  title: "Best Software for Real Estate Photographers in 2026 | Kyoria OS",
  description:
    "A practical breakdown of every tool category real estate photographers rely on, and how to stop managing them all separately.",
};

export default function BestSoftwarePage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/blog" className="text-white/40 text-xs hover:text-white/65 transition-colors">
              &larr; Back to Blog
            </Link>
          </div>
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Software Guide</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Best Software for Real Estate Photographers in 2026
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            A practical breakdown of every tool category real estate photographers rely on, and how to stop managing them all separately.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <article className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto prose prose-sm prose-gray">

          <h2 className="font-serif text-2xl text-navy font-normal mt-0 mb-4">The tool problem every photographer knows</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Most real estate photographers are running their business across five or six different platforms at any given time. There is a booking tool, a cloud storage folder, an invoicing app, a CRM spreadsheet, a group chat for dispatching shooters, and maybe a separate client delivery tool on top of it all. Each one costs money. Each one requires logging in, learning, and maintaining. And none of them talk to each other.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The software question for real estate photographers in 2026 is not really about finding the best tool in each category. It is about deciding how many categories you actually need to juggle, and whether a more consolidated approach makes your business run better.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">The core tool categories</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Before we get into specific platforms, it helps to name the categories that every real estate photography business needs to cover.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Booking and scheduling</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Clients need a way to request shoots, see your availability, and confirm appointments without calling or texting you. Basic scheduling tools like Calendly can handle this at a surface level, but they do not know anything about service areas, package pricing, or team assignments. A purpose-built <Link href="/features/booking-scheduling" className="text-navy underline underline-offset-2 hover:text-navy/70">booking and scheduling</Link> system for real estate photographers handles all of that in one flow.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Gallery delivery</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Dropbox and Google Drive work for file transfer, but they are not delivery tools. A real estate photography delivery system needs to handle multiple file types (photos, video, floor plans, 3D tours), organize them clearly for the agent, and ideally hold the download behind a payment confirmation. Kyoria OS builds this into <Link href="/features/gallery-delivery" className="text-navy underline underline-offset-2 hover:text-navy/70">gallery delivery</Link> so the gallery only unlocks when the balance is paid.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Payments and invoicing</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Wave, QuickBooks, and HoneyBook are the common choices here. They generate invoices and collect payments, but they have no connection to the shoot or the delivery. That disconnect means you are still manually tracking who has paid before releasing a gallery. <Link href="/features/payments-automation" className="text-navy underline underline-offset-2 hover:text-navy/70">Payments automation</Link> that ties directly to delivery removes that manual step entirely.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Team management</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            As soon as you hire a second photographer, you need a way to assign shoots, track availability, and communicate job details without relying on text messages. Dedicated <Link href="/features/team-management" className="text-navy underline underline-offset-2 hover:text-navy/70">team management</Link> tools for photography businesses handle dispatch, photographer assignment, and job status in one place.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Client and agent CRM</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            Agents are repeat clients. Knowing their preferences, order history, and communication style is valuable. A spreadsheet or a generic CRM like HubSpot can store contacts, but a tool built for real estate photography understands that an agent is different from a homeowner, and that an agent with thirty active listings needs different treatment than a one-time client.
          </p>

          <h3 className="font-semibold text-navy text-base mt-6 mb-2">Service area routing</h3>
          <p className="text-gray-600 leading-relaxed mb-4">
            If you cover multiple zip codes or zones, you need a way to define where you work, assign the right pricing and availability by area, and route bookings accordingly. Very few general tools handle this. It is largely a real-estate-specific need, covered by <Link href="/features/service-areas" className="text-navy underline underline-offset-2 hover:text-navy/70">service area</Link> configuration inside platforms built specifically for property media businesses.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Why all-in-one beats multiple tools</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            The argument for running separate tools is usually that each one does its specific job better than a combined system. That was more true five years ago. Today, the cost of integration, context-switching, and maintaining separate logins and billing relationships outweighs the marginal gain in any single category.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            When your booking system knows about your service areas, your team availability, your pricing, and your payment status, every part of your operation gets faster. You stop asking yourself which app has the information you need. You stop manually copying data from one system to another.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Kyoria OS is built to cover all of these categories in a single platform designed specifically for real estate photography businesses. That means the booking, the team dispatch, the gallery delivery, and the payment collection all connect automatically, without any manual bridging work on your end.
          </p>

        </div>
      </article>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            All of these categories, covered in one platform.
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Stop paying for six tools that do not talk to each other.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm"
          >
            Get Started &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
