"use client";

/**
 * Wraps one or more Agent Pro gated sections.
 * Renders children blurred/ghosted with a SINGLE premium upgrade card overlaid.
 * Use once per page section — not once per individual widget — to avoid
 * stacked duplicate lock cards.
 *
 * Usage (single feature):
 *   <AgentProGate><YourFeatureBlock /></AgentProGate>
 *
 * Usage (multiple features, one interstitial):
 *   <AgentProGate>
 *     <FirstLockedBlock />
 *     <SecondLockedBlock />
 *   </AgentProGate>
 */
export default function AgentProGate({ children }) {
  return (
    <div className="relative">
      {/* Ghost/blur the locked content */}
      <div className="pointer-events-none select-none opacity-30 blur-[3px]">
        {children}
      </div>

      {/* Single premium interstitial — centered over entire gated area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 py-8">
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-sm px-8 py-7 text-center max-w-xs w-full">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3486cf]/10 to-[#3486cf]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          {/* Copy */}
          <p className="text-sm font-bold text-gray-900 mb-1.5">Agent Pro Feature</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">
            Unlock team collaboration, personal branding, long-term history, and more.
          </p>

          {/* CTA */}
          <button
            onClick={() => alert("Agent Pro is coming soon. Contact your photographer to learn more.")}
            className="w-full text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#3486cf] text-white hover:bg-[#2a72b8] transition-colors"
          >
            Learn about Agent Pro
          </button>
        </div>
      </div>
    </div>
  );
}
