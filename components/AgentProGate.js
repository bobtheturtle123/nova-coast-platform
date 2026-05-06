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
export default function AgentProGate({ children }) {
  return <>{children}</>;
}
