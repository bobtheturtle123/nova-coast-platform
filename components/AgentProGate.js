"use client";

/**
 * Wraps Agent Pro gated sections. Renders children when isAgentPro is true;
 * otherwise renders blurred content with a real upgrade CTA.
 *
 * Usage:
 *   <AgentProGate isAgentPro={agent?.isAgentPro} onUpgrade={handleUpgrade}>
 *     <LockedFeature />
 *   </AgentProGate>
 */
export default function AgentProGate({ children, isAgentPro = false, onUpgrade, upgrading = false }) {
  if (isAgentPro) return <>{children}</>;

  return (
    <div className="relative">
      {/* Ghost/blur the locked content */}
      <div className="pointer-events-none select-none opacity-30 blur-[3px]">
        {children}
      </div>

      {/* Premium interstitial */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 py-8">
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-sm px-8 py-7 text-center max-w-xs w-full">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3486cf]/10 to-[#3486cf]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <p className="text-sm font-bold text-gray-900 mb-1">Agent Pro</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-1.5">
            Team collaboration, personal branding, listing history, and more.
          </p>
          <p className="text-lg font-bold text-[#3486cf] mb-5">$15.99<span className="text-xs font-normal text-gray-400">/month</span></p>

          {onUpgrade ? (
            <button
              onClick={onUpgrade}
              disabled={upgrading}
              className="w-full text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#3486cf] text-white hover:bg-[#2a72b8] transition-colors disabled:opacity-60"
            >
              {upgrading ? "Redirecting…" : "Upgrade to Agent Pro →"}
            </button>
          ) : (
            <p className="text-xs text-gray-400">Contact your photographer to enable Agent Pro.</p>
          )}
        </div>
      </div>
    </div>
  );
}
