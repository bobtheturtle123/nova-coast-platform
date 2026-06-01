import Link from "next/link";

export const metadata = {
  title: "Blog — Real Estate Photography Business Tips | Kyoria OS",
  description:
    "Tips, guides, and insights for real estate photographers and media teams.",
  alternates: { canonical: "https://kyoriaos.com/blog" },
};

const POSTS = [
  {
    slug: "best-software-real-estate-photographers-2026",
    title: "Best Software for Real Estate Photographers in 2026",
    teaser:
      "A practical breakdown of every tool category real estate photographers rely on, and how to stop managing them all separately.",
  },
  {
    slug: "automate-real-estate-photography-business",
    title: "How to Automate Your Real Estate Photography Business",
    teaser:
      "From booking to final payment, here is how to remove every manual step from your workflow.",
  },
  {
    slug: "how-photography-teams-manage-scheduling-delivery",
    title: "How Top Photography Teams Manage Scheduling and Delivery",
    teaser:
      "The systems that growing real estate media teams use to stay organized without the group chat chaos.",
  },
  {
    slug: "why-photographers-leaving-multiple-tools",
    title: "Why Real Estate Photographers Are Leaving Multiple Tools Behind",
    teaser:
      "The hidden cost of running your business across six different platforms, and what the switch to one system actually looks like.",
  },
  {
    slug: "real-estate-photography-client-experience",
    title: "How to Create a Professional Client Experience as a Real Estate Photographer",
    teaser:
      "From the booking page to gallery delivery, how every client touchpoint affects your repeat business.",
  },
];

export default function BlogIndexPage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS Blog</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Resources for real estate media businesses
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            Practical guides for photographers, editors, and team leads who want to run a tighter operation.
          </p>
        </div>
      </section>

      {/* POST GRID */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <article
              key={post.slug}
              className="border border-gray-100 rounded-2xl p-6 flex flex-col hover:border-navy/20 hover:shadow-sm transition-all"
            >
              <h2 className="font-serif text-navy text-lg font-normal leading-snug mb-3 flex-1">
                {post.title}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-5">{post.teaser}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="text-sm font-medium text-navy hover:text-navy/70 transition-colors"
              >
                Read more &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-cream border-t border-gray-100 py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Ready to get organized?</p>
          <h2 className="font-serif text-3xl text-navy font-normal mb-4">
            See how Kyoria OS works for your business
          </h2>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed">
            Booking, scheduling, gallery delivery, and payments all in one place.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-navy text-white font-semibold px-8 py-4 rounded-xl hover:bg-navy/90 transition-colors text-sm"
          >
            Get Started &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
