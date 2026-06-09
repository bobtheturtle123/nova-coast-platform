import GuideShell, { GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "The Built-in AI Assistant - Captions, Descriptions & Help | KyoriaOS",
  description:
    "KyoriaOS includes an AI assistant that writes social media captions and property descriptions, imports pricing from a competitor's page, and answers questions about the platform.",
  alternates: { canonical: "https://kyoriaos.com/guides/ai-assistant" },
};

const USES = [
  { icon: "✍️", t: "Social media captions", d: "Generate ready-to-post captions for a listing's photos - agents can grab them from their portal." },
  { icon: "🏡", t: "Property descriptions", d: "Turn a few details into a polished listing description for the property website." },
  { icon: "📥", t: "Import pricing", d: "Paste a competitor's pricing page or text and the AI extracts your packages and prices automatically." },
  { icon: "💡", t: "Help & how-to", d: "Ask the in-dashboard assistant how to do anything in KyoriaOS - it knows the platform." },
];

export default function AiAssistantGuide() {
  return (
    <GuideShell
      eyebrow="AI Assistant"
      title="The built-in AI assistant"
      intro="KyoriaOS has AI baked in to do the writing you'd rather not - captions, descriptions, and quick answers - so you spend less time at the keyboard."
      currentSlug="ai-assistant"
    >
      <GuideH2>What it can do</GuideH2>
      <div className="grid sm:grid-cols-2 gap-3">
        {USES.map((x) => (
          <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-2">{x.icon}</div>
            <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      <GuideH2>Where to find it</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>💬 <strong>Help assistant:</strong> the chat button in your dashboard - ask it anything about using KyoriaOS.</li>
          <li>✍️ <strong>Captions:</strong> on a listing and in the agent portal, generate social captions for the photos.</li>
          <li>🏡 <strong>Descriptions:</strong> from a listing&apos;s Property Site tab when filling in the description.</li>
          <li>📥 <strong>Pricing import:</strong> Products → Import from Website.</li>
        </ul>
      </div>

      <GuideH2>How it works</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-[14px] text-gray-600 leading-relaxed">
          The assistant is powered by leading AI models (DeepSeek, with OpenAI&apos;s GPT as a fallback) so it&apos;s fast and
          reliable. It only uses the details you give it for the task at hand - it doesn&apos;t post anything on its own, and
          you always review and edit before anything goes out.
        </p>
      </div>
    </GuideShell>
  );
}
