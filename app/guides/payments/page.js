import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Getting Paid with Stripe — Deposits, Balances & Payouts | KyoriaOS",
  description:
    "How payments work in KyoriaOS: connect Stripe, take deposits at booking, automatically collect the balance on delivery, record manual payments, and track revenue.",
  alternates: { canonical: "https://kyoriaos.com/guides/payments" },
};

const STEPS = [
  { title: "Connect Stripe", body: <>In <strong>Settings → Billing</strong> (or during onboarding), connect your Stripe account. Payments from clients go <strong>straight to you</strong> — KyoriaOS just takes a small platform fee.</> },
  { title: "Set your deposit", body: <>In booking settings, choose a deposit (a percentage or flat amount, or none). Clients pay the deposit when they book, and the rest is due at delivery.</> },
  { title: "Client books and pays", body: <>On your booking page the client picks services, schedules, and pays securely via Stripe. The job is created automatically.</> },
  { title: "Balance collected on delivery", body: <>When you deliver the gallery, the <strong>remaining balance is requested at the same moment</strong> — downloads unlock once it&apos;s paid. No chasing invoices.</> },
  { title: "Record manual payments (optional)", body: <>Paid by cash, e-transfer, or phone? On the listing&apos;s <strong>Payments</strong> tab, use “Mark deposit paid” / “Mark paid in full” and enter the exact amount received.</> },
];

export default function PaymentsGuide() {
  return (
    <GuideShell
      eyebrow="Payments"
      title="Getting paid with Stripe"
      intro="KyoriaOS handles deposits, balances, and payouts so you can stop chasing money. Payments flow directly into your own Stripe account."
      currentSlug="payments"
    >
      <GuideH2>How it works</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>Good to know</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>💸 <strong>You own the money.</strong> Funds settle in your Stripe account on Stripe&apos;s normal payout schedule.</li>
          <li>🏷️ <strong>Promo codes</strong> apply to the amount actually charged — see the <a href="/guides/promo-codes" className="text-[#3486cf] underline">promo codes guide</a>.</li>
          <li>🆓 <strong>Free / very small bookings:</strong> if a discount drops the total below Stripe&apos;s $0.50 minimum, the booking completes with no charge instead of failing.</li>
          <li>📊 <strong>Reports</strong> only count money you&apos;ve actually collected — never unpaid balances — so your revenue numbers stay honest.</li>
          <li>🧾 <strong>Send links anytime:</strong> deposit requests, balance links, and invoices are one click from the Payments tab.</li>
        </ul>
      </div>
    </GuideShell>
  );
}
