import Link from "next/link";

export const metadata = {
  title: "How Top Photography Teams Manage Scheduling and Delivery | Kyoria OS",
  description:
    "The systems that growing real estate media teams use to stay organized without the group chat chaos.",
  alternates: { canonical: "https://kyoriaos.com/blog/how-photography-teams-manage-scheduling-delivery" },
};

export default function TeamsSchedulingPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Team Operations</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            How Top Photography Teams Manage Scheduling and Delivery
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            The systems that growing real estate media teams use to stay organized without the group chat chaos.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <article className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">

          <h2 className="font-serif text-2xl text-navy font-normal mt-0 mb-4">The moment a photography business becomes a team problem</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Every photography business starts with one person doing everything. Scheduling is simple because there is only one calendar to check. Delivery is straightforward because there is only one person uploading and sending. But the moment you bring on a second photographer, or a dedicated editor, or a drone operator, the complexity multiplies faster than most owners expect.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Suddenly you are managing availability for multiple people, deciding who goes to which job, making sure the right person has the right briefing, and tracking whether the job was completed and the files delivered. Most teams handle this with a combination of group texts, shared spreadsheets, and hope. It works until it does not.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">What actually breaks in group chat scheduling</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Group chats are fast to set up and feel convenient. But they have several failure modes that compound as your team grows. Important job details get buried in unrelated messages. Someone confirms a job without checking the right channel. Double bookings happen because two people see the same request at the same time. Availability changes never make it to the person assigning jobs.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The other problem is accountability. When instructions and confirmations happen in chat, there is no clear job record. If something goes wrong, it is difficult to reconstruct what was communicated to whom and when. That ambiguity creates friction between team members and with clients.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">How well-run teams structure their scheduling</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            The teams that operate smoothly at scale share a common approach: they centralize job information in a single system, make availability visible to everyone who needs it, and assign jobs formally rather than through conversation.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            With proper <Link href="/features/team-management" className="text-navy underline underline-offset-2 hover:text-navy/70">team management</Link> tooling, a job comes in through the booking system with a service area, package, and time slot already confirmed. The scheduler can see which photographers are available in that zone, assign the job, and send a confirmation to the photographer, all within the same platform. The photographer receives the briefing with the address, package details, and access notes. No back-and-forth required.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Availability is maintained inside the platform rather than through a separate calendar that nobody checks. When a photographer marks themselves unavailable, that information is immediately reflected in what slots the booking system offers to clients. The system enforces consistency that a group chat never can.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Delivery at team scale</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Delivery becomes complicated when multiple photographers are shooting different jobs simultaneously and multiple editors are processing the results. Without a clear system, files get mixed up, deliveries go to the wrong clients, and the status of any given job is a mystery unless you ask around.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            The cleanest approach is connecting the delivery process directly to the job record. When the editor finishes processing, they upload directly to the job in the platform. The delivery goes to the correct client automatically, linked to the right address and agent. The team lead can see the status of every job in a single view without asking anyone.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Kyoria OS <Link href="/features/gallery-delivery" className="text-navy underline underline-offset-2 hover:text-navy/70">gallery delivery</Link> works this way. Each job has its own delivery record tied to the booking and the client. When files are uploaded and the gallery is sent, the payment gate handles collection automatically. There is no separate step to send an invoice or track whether payment came through before releasing files.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">The mindset shift that makes teams work</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Beyond the tools, the teams that run well make a deliberate decision to treat the platform as the source of truth. Job details live in the system, not in someone's head or their text messages. If it is not in the platform, it did not happen.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            That discipline pays off as you scale. Every new photographer you bring on learns the same process. Every client gets the same experience regardless of which photographer shoots their property. And every job leaves a clear record that you can reference if questions come up later.
          </p>

        </div>
      </article>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Built for real estate photography teams.
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Assign jobs, track delivery, and manage your whole team from one place.
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
