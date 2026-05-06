"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getAppUrl } from "@/lib/appUrl";

function AgentSettingsInner() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const slug  = params.slug;
  const token = searchParams.get("token") || (typeof window !== "undefined" ? localStorage.getItem(`agent-token-${slug}`) || "" : "");

  const [agent,   setAgent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);
  const [phone,   setPhone]   = useState("");

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
