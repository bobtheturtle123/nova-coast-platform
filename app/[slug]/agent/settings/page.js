"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AgentProGate from "@/components/AgentProGate";
import { getAppUrl } from "@/lib/appUrl";

function AgentSettingsInner() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const slug  = params.slug;
  const token = searchParams.get("token") || (typeof window !== "undefined" ? localStorage.getItem(`agent-token-${slug}`) || "" : "");

  const [agent,         setAgent]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saved,         setSaved]         = useState(false);
  const [teamMembers,   setTeamMembers]   = useState([]);
  const [teamLoading,   setTeamLoading]   = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteName,    setInviteName]    = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState({ text: "", type: "" });
  const [upgrading,     setUpgrading]     = useState(false);
  const [agentProMsg,   setAgentProMsg]   = useState("");

  // Editable fields
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`/api/${slug}/agent/me?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.agent) {
          setAgent(d.agent);
          setPhone(d.agent.phone || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, token]);

  useEffect(() => {
    if (searchParams.get("agentpro") === "success") {
      setAgentProMsg("Agent Pro activated! Your new features are now unlocked.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token || !agent?.isAgentPro) return;
    setTeamLoading(true);
    fetch(`/api/${slug}/agent/team?token=${token}`)
      .then((r) => r.json())
      .then((d) => { if (d.members) setTeamMembers(d.members); })
      .catch(() => {})
      .finally(() => setTeamLoading(false));
  }, [slug, token, agent?.isAgentPro]);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteMsg({ text: "", type: "" });
    try {
      const res = await fetch(`/api/${slug}/agent/team`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, email: inviteEmail.trim(), name: inviteName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTeamMembers((prev) => [...prev, data.member]);
        setInviteEmail("");
        setInviteName("");
        setInviteMsg({ text: "Invite sent successfully.", type: "success" });
      } else {
        setInviteMsg({ text: data.error || "Failed to send invite.", type: "error" });
      }
    } catch {
      setInviteMsg({ text: "Something went wrong.", type: "error" });
    } finally {
      setInviteSending(false);
      setTimeout(() => setInviteMsg({ text: "", type: "" }), 4000);
    }
  }

  async function upgradeToAgentPro() {
    setUpgrading(true);
    try {
      const res  = await fetch(`/api/${slug}/agent/billing`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setAgentProMsg(data.error || "Could not start checkout. Try again.");
        setUpgrading(false);
      }
    } catch {
      setAgentProMsg("Something went wrong. Please try again.");
      setUpgrading(false);
    }
  }

  async function removeInvite(email) {
    try {
      const res = await fetch(`/api/${slug}/agent/team`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, email }),
      });
      if (res.ok) setTeamMembers((prev) => prev.filter((m) => m.email !== email));
    } catch { /* silent */ }
  }

  async function save() {
    if (!token) return;
    const res = await fetch(`/api/${slug}/agent/me`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, phone }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-400">Unable to load your profile. Try reloading the page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your agent portal preferences.</p>
      </div>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Name</label>
            <p className="text-sm font-medium text-gray-800">{agent.name || "—"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Email</label>
            <p className="text-sm font-medium text-gray-800">{agent.email || "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">Contact your photographer to update your name or email.</p>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
              placeholder="(555) 000-0000"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save}
            className="text-sm font-semibold px-5 py-2 rounded-lg text-white bg-[#3486cf] hover:bg-[#2a72b8] transition-colors">
            Save Changes
          </button>
          {saved && <p className="text-sm text-emerald-600 font-medium">Saved ✓</p>}
        </div>
      </div>

      {/* Agent Pro status message */}
      {agentProMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          agentProMsg.includes("activated") ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {agentProMsg}
        </div>
      )}

      {/* Agent Pro gated features — single consolidated lock interstitial */}
      <AgentProGate isAgentPro={agent?.isAgentPro} onUpgrade={upgradeToAgentPro} upgrading={upgrading}>
        <div className="space-y-6">
          {/* Personal Branding */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Personal Branding</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Headshot URL</label>
                <input type="url" disabled className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">Bio</label>
                <textarea disabled rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none" placeholder="Write a short bio…" />
              </div>
            </div>
          </div>

          {/* Team Access */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Team Collaboration</h2>
            <p className="text-xs text-gray-400 mb-5">Share portal access with assistants, TCs, and marketing coordinators.</p>

            {/* Invite form */}
            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
                  placeholder="Name (optional)"
                />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
                  placeholder="Email address"
                />
              </div>
              <button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim()}
                className="text-sm font-semibold px-4 py-2 rounded-lg text-white bg-[#3486cf] hover:bg-[#2a72b8] transition-colors disabled:opacity-50">
                {inviteSending ? "Sending…" : "+ Send Invite"}
              </button>
              {inviteMsg.text && (
                <p className={`text-xs font-medium ${inviteMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                  {inviteMsg.text}
                </p>
              )}
            </div>

            {/* Member list */}
            {teamLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
                Loading…
              </div>
            ) : teamMembers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Invited Members</p>
                {teamMembers.map((m) => (
                  <div key={m.email} className="flex items-center justify-between gap-3 py-2.5 px-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      {m.name && <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>}
                      <p className={`text-xs truncate ${m.name ? "text-gray-400" : "text-sm font-medium text-gray-800"}`}>{m.email}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      m.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {m.status === "accepted" ? "Active" : "Pending"}
                    </span>
                    <button onClick={() => removeInvite(m.email)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Remove access">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No team members added yet.</p>
            )}
          </div>
        </div>
      </AgentProGate>

      {/* Portal Access */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Portal Access</h2>
        <p className="text-xs text-gray-500 mb-3">Your portal link is tied to a unique access token. If you need a new link, contact your photographer.</p>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono break-all">
          {getAppUrl()}/{slug}/agent?token=•••
        </div>
      </div>
    </div>
  );
}

export default function AgentSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    }>
      <AgentSettingsInner />
    </Suspense>
  );
}
