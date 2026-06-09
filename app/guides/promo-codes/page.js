import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Promo Codes & Discounts for Real Estate Photographers | KyoriaOS",
  description:
    "Create discount codes in KyoriaOS: flat or percentage off, usage limits, expiry dates, minimum order, and first-time-client offers - applied automatically at checkout.",
  alternates: { canonical: "https://kyoriaos.com/guides/promo-codes" },
};

const STEPS = [
  { title: "Open Promo Codes", body: <>Go to <strong>Dashboard → Products → Promo codes</strong> and click <strong>+ New</strong>.</> },
  { title: "Set the discount", body: <>Choose <strong>flat</strong> (e.g. $50 off) or <strong>percentage</strong> (e.g. 10% off) and the amount.</> },
  { title: "Add rules (optional)", body: <>Limit total uses, set an expiry date, require a minimum order, or make it <strong>first-time clients only</strong>.</> },
  { title: "Share the code", body: <>Give the code to clients in emails, ads, or to win back repeat business. They enter it on the booking <strong>review</strong> step.</> },
];

export default function PromoCodesGuide() {
  return (
    <GuideShell
      eyebrow="Promo Codes"
      title="Promo codes & discounts"
      intro="Run promotions, reward loyal agents, or close a deal with a discount code - applied automatically to the price the client actually pays."
      currentSlug="promo-codes"
    >
      <GuideH2>Create a code</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>How it applies</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>✅ The discount is taken off the <strong>total the client is charged</strong> - and the deposit/balance adjust accordingly.</li>
          <li>🔒 Codes are <strong>re-checked on the server</strong> at checkout, so they can&apos;t be tampered with.</li>
          <li>📈 Each use is <strong>counted</strong>, so usage limits are enforced.</li>
          <li>🆓 If a code makes a booking essentially free, it still completes cleanly - see the <a href="/guides/payments" className="text-[#3486cf] underline">payments guide</a>.</li>
        </ul>
      </div>

      <GuideH2>Ideas that work</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>🎉 <strong>WELCOME10</strong> - first-time-only 10% off to win new agents.</li>
          <li>🔁 <strong>LOYAL25</strong> - $25 off for repeat clients after their 5th booking.</li>
          <li>📅 <strong>SLOWSEASON</strong> - a limited-time % off to fill quiet weeks.</li>
        </ul>
      </div>
    </GuideShell>
  );
}
