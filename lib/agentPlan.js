// Agent Pro feature gate definitions.
// Billing is not yet wired — locked features show upgrade prompts.

export const AGENT_PRO_FEATURES = {
  long_term_history:  "Access listing history beyond 12 months",
  team_invites:       "Invite assistants, TCs, and marketing coordinators",
  seller_share_links: "Generate read-only share links for sellers",
  saved_branding:     "Save personal headshot, bio, and brand colors",
};

export function isAgentPro(agent) {
  return agent?.isAgentPro === true;
}

// Returns true if the feature is locked for this agent
export function isLocked(featureId, agent) {
  return featureId in AGENT_PRO_FEATURES && !isAgentPro(agent);
}
