import Link from "next/link";

export const metadata = {
  title: "How to Create a Professional Client Experience as a Real Estate Photographer | Kyoria OS",
  description:
    "From the booking page to gallery delivery, how every client touchpoint affects your repeat business.",
};

export default function ClientExperiencePage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Client Experience</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            How to Create a Professional Client Experience as a Real Estate Photographer
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            From the booking page to gallery delivery, how every client touchpoint affects your repeat business.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <article className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">

          <h2 className="font-serif text-2xl text-navy font-normal mt-0 mb-4">Why client experience is a business strategy</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Real estate photography is a repeat-purchase business. Agents who list properties regularly need media produced consistently. When an agent books you once and has a smooth experience, the likelihood of a second booking is high. When they book you and encounter friction, they start exploring alternatives even if the photos themselves were excellent.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The photography quality sets the floor. The client experience determines whether you keep the relationship. Most photographers invest heavily in the former and almost nothing in the latter. The gap there is a significant competitive advantage for anyone willing to close it.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">The booking page is your first impression</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            The booking experience sets the tone before you ever arrive at a property. If an agent has to call or text to request a shoot, check your availability through back-and-forth messages, and wait for a confirmation email, that is friction right at the start of the relationship.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            A professional booking page lets agents see your availability, choose a package, enter the property details, and pay a deposit without any intervention from you. It signals that your business is organized, that you take their time seriously, and that working with you is going to be straightforward.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The design and flow of the booking page matters too. A clean, branded page that loads quickly and works on a phone communicates professionalism before a single photo is taken. A form that looks like it was built in five minutes says something different.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Communication between booking and shoot day</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            After booking, the quality of communication affects how the agent feels going into shoot day. Automated confirmations and reminders are the baseline. But the content of those messages matters. An agent who receives a reminder with the full address, the scheduled time, what to expect during the shoot, and who to contact with questions is in a much better position than one who receives a generic calendar confirmation.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Most photographers underinvest in pre-shoot communication because it requires writing messages and the automation requires setting things up once. That setup time pays back quickly when it reduces day-of calls and last-minute questions from agents who are not sure what is happening.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Gallery delivery as a brand moment</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Delivery is the highest-stakes client touchpoint because it is when the agent sees the actual work. The experience surrounding that reveal matters. A Dropbox link in a plain email is functional. A branded gallery delivered through a clean, organized platform feels like a premium service.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            The practical difference in effort is minimal. But the perception gap is large. An agent who receives a polished gallery through a dedicated delivery link, with all their media organized and immediately downloadable after payment, has a tangibly different experience than one digging through folders in a shared drive.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Kyoria OS <Link href="/features/client-portal" className="text-navy underline underline-offset-2 hover:text-navy/70">client portal</Link> gives agents a dedicated space to access all of their orders, view delivery history, and download files without needing to track down links from old emails. For busy agents with multiple active listings, this kind of organized access is a genuine convenience that they notice and appreciate.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">After delivery: the follow-through most photographers skip</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            The job is not over when the gallery is delivered. What happens after sets up the next booking. A quick check-in to confirm the agent received everything and is happy with the results takes thirty seconds and reinforces the relationship. A straightforward revision process that does not require email chains or new file folders signals that you stand behind your work.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Agents who feel looked after book again without needing to be asked. The ones who feel like they are just another transaction explore other options. The photographers who grow their agent roster the fastest are usually not the best photographers in their market. They are the ones who made working with them easy and consistent from the first touchpoint to the last.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Building this without rebuilding everything</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Improving every one of these touchpoints does not require starting over. It requires having the right infrastructure in place. A platform that handles booking, communication, delivery, and post-delivery access in one connected system makes it possible to maintain a high standard consistently, even as your volume grows. Kyoria OS is designed for exactly that, with each part of the client experience connected to the same job record so nothing falls through.
          </p>

        </div>
      </article>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Give every client a professional experience.
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            From booking page to gallery delivery, all in one connected platform.
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
