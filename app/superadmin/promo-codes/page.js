"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function PromoCodesPage() {
  const [codes,    setCodes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [form,     setForm]     = useState({ code: "", maxUses: "1" });
  const [msg,      setMsg]      = useState("");
  const [newCode,  setNewCode]  = useState(null);
  const [copied,   setCopied]   = useState(false);

  async function getToken() {
    return auth.currentUser?.getIdToken();
  }

  async function load() {
    setLoading(true);
    const token = await getToken();
    const res   = await fetch("/api/admin/promo-codes", { headers: { Authorization: `Bearer ${token}` } });
    const data  = await res.json();
    setCodes(data.codes || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    setNewCode(null);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/promo-codes", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: form.code || undefined, maxUses: Number(form.maxUses) }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Failed to create code."); return; }
      setNewCode(data.code);
      setForm({ code: "", maxUses: "1" });
      load();
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(id) {
    if (!confirm("Deactivate this promo code?")) return;
    const token = await getToken();
    await fetch("/api/admin/promo-codes", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ id }),
    });
    load();
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Promo Codes</h1>
      <p className="text-sm text-gray-500 mb-8">Generate 1-month-free codes to give to photographer friends. Each code is 100% off the first month of any plan.</p>

      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Generate a new code</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Custom code (optional)</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. FRIEND2026"
              maxLength={20}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#3486cf]"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Max uses</label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3486cf]"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2 bg-[#3486cf] text-white text-sm font-semibold rounded-xl hover:bg-[#2a6dab] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Generate Code"}
          </button>
        </form>
        {msg && <p className="text-sm text-red-600 mt-3">{msg}</p>}
      </div>

      {/* New code callout */}
      {newCode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-emerald-700 mb-1">New code created!</p>
            <p className="font-mono text-2xl font-bold text-emerald-800 tracking-widest">{newCode}</p>
            <p className="text-xs text-emerald-600 mt-1">Share this with a photographer friend — 100% off their first month on any plan.</p>
          </div>
          <button
            onClick={() => copyCode(newCode)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex-shrink-0"
          >
            {copied === newCode ? "Copied!" : "Copy Code"}
          </button>
        </div>
      )}

      {/* Code list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">All promotion codes</h2>
          <button onClick={load} className="text-xs text-[#3486cf] hover:underline">Refresh</button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">No promo codes yet. Generate one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">{c.code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {c.couponName} · {c.uses} / {c.maxUses ?? "∞"} uses
                    {c.expiresAt && ` · expires ${c.expiresAt}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyCode(c.code)}
                    className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#3486cf]/5 transition-colors"
                  >
                    {copied === c.code ? "Copied!" : "Copy"}
                  </button>
                  {c.active && (
                    <button
                      onClick={() => deactivate(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Codes work at Stripe Checkout when signing up for any paid plan. One use per customer. The first month is 100% free, then normal pricing applies.
      </p>
    </div>
  );
}
