"use client";

// Renders a locked overlay for Agent Pro gated features.
// Drop it around any content that needs gating:
//   <AgentProGate feature="team_invites"><ActualContent /></AgentProGate>
export default function AgentProGate({ feature, children }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-xl z-10 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-[#3486cf]/10 flex items-center justify-center mb-3">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#0F172A] mb-1">Agent Pro Feature</p>
        <p className="text-xs text-gray-400 mb-4 max-w-xs">
          This feature is available on Agent Pro. Upgrade to unlock team collaboration, long-term history, and more.
        </p>
        <button
          onClick={() => alert("Agent Pro subscriptions coming soon. Contact your photographer to learn more.")}
          className="text-xs font-semibold px-4 py-2 rounded-full bg-[#3486cf] text-white hover:bg-[#3486cf]/90 transition-colors"
        >
          Learn about Agent Pro
        </button>
      </div>
    </div>
  );
}
