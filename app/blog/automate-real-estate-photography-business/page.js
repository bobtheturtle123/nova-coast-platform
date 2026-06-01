import Link from "next/link";

export const metadata = {
  title: "How to Automate Your Real Estate Photography Business | Kyoria OS",
  description:
    "From booking to final payment, here is how to remove every manual step from your workflow.",
  alternates: { canonical: "https://kyoriaos.com/blog/automate-real-estate-photography-business" },
};

export default function AutomatePage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Business Operations</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            How to Automate Your Real Estate Photography Business
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            From booking to final payment, here is how to remove every manual step from your workflow.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <article className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">

          <h2 className="font-serif text-2xl text-navy font-normal mt-0 mb-4">What automation actually means for photographers</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Automation in a photography business does not mean robots doing your shoots. It means removing the repetitive administrative work that happens before and after every job. Confirming appointments, collecting deposits, sending reminders, following up on unpaid invoices, releasing galleries after payment. All of these are steps that currently consume hours each week for most photographers. Every one of them can run without you touching anything.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The result is not just time saved. It is a more consistent client experience, fewer dropped balls, and a business that does not grind to a halt when you are on location for eight hours.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Step 1: Online booking with automatic deposit collection</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            The first step is replacing the back-and-forth of quote requests and DMs with a proper online booking flow. A good <Link href="/features/booking-scheduling" className="text-navy underline underline-offset-2 hover:text-navy/70">booking and scheduling</Link> system lets agents choose the date, select their package, enter the property address, and pay a deposit in a single uninterrupted session.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            The deposit collection is critical. When payment happens at booking rather than after the fact, you eliminate an entire category of follow-up work. The job is booked and partially paid before you ever confirm it. This also filters out low-intent inquiries without any extra effort on your part.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Step 2: Automated shoot reminders</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            No-shows and last-minute cancellations are expensive. Automated reminders sent 24 hours and 2 hours before the appointment significantly reduce both. This is a step that most photographers do manually, if at all, usually by texting or emailing the morning of the shoot.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            When reminders are automatic, they go out consistently every time, at the right intervals, with the right job details included. The agent knows the address, the time, and what to expect without you having to type anything.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Step 3: Automatic balance collection before delivery</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Chasing the remaining balance after a shoot is one of the most common time drains in the industry. The typical flow is: shoot the job, upload the photos, send the invoice, wait, follow up, wait again, eventually get paid, then release the files. This can stretch across a week.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            The fix is tying gallery access directly to payment. With <Link href="/features/payments-automation" className="text-navy underline underline-offset-2 hover:text-navy/70">payments automation</Link>, the gallery link is sent when the job is complete, but the files stay locked until the remaining balance clears through Stripe. The client pays, Stripe confirms, and the gallery unlocks automatically. You never check in, never send a reminder, and never delay delivery to avoid awkward conversations.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            This single change eliminates more back-and-forth than almost anything else photographers implement.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Step 4: Gallery delivery without manual file management</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Manual delivery typically looks like this: download photos from your editing software, organize them into a folder, upload to Dropbox or Google Drive, copy the link, open your email, write a message, paste the link, and send. For video and floor plans, you do it again.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            An automated <Link href="/features/gallery-delivery" className="text-navy underline underline-offset-2 hover:text-navy/70">gallery delivery</Link> system replaces that entire sequence with a single upload. Photos, video, floor plans, and 3D tour links go into one job record. The client receives one branded link that contains everything. The delivery is professional, organized, and requires about four minutes of your time rather than thirty.
          </p>

          <h2 className="font-serif text-2xl text-navy font-normal mt-10 mb-4">Putting it together</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            When you automate each of these steps inside a connected platform, the cumulative effect is significant. A job goes from inquiry to completed delivery with your direct involvement at two points: the shoot itself, and the upload. Everything else, confirmation, reminders, payment collection, gallery release, runs on its own.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            The other benefit is consistency. Every client gets the same experience regardless of how many jobs you have in progress. That consistency builds trust, generates repeat business, and makes your operation look larger and more professional than it might actually be.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Kyoria OS is built around this connected workflow, so the automation does not require you to connect multiple tools together yourself. The booking, payments, scheduling, and delivery are all part of the same system.
          </p>

        </div>
      </article>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Remove the manual steps from your workflow.
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Booking, payments, gallery delivery, and reminders all connected in one platform.
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
