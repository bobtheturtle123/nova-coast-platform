"use client";

import { useState } from "react";

export default function JoinClient({ token, tenantId, companyName, inviteEmail }) {
  const [form, setForm] = useState({
    name:  "",
    phone: "",
    email: inviteEmail || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Please enter your name."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/join/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-navy mb-2">You&apos;re in!</h1>
          <p className="text-gray-500 text-sm mb-4">
            You&apos;ve joined the <strong>{companyName}</strong> team.
            The admin will assign you shoots and you&apos;ll start receiving booking notifications.
          </p>
          <p className="text-xs text-gray-400">
            You can close this window. The admin will set up your calendar sync from the Team dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <div className="w-14 h-14 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#0b2a55" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-navy mb-1">Join {companyName}</h1>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ve been invited to join the photography team. Confirm your details below to accept.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors"
              placeholder="First and last name"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors bg-gray-50"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone (optional)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !form.name.trim()}
            className="w-full bg-navy text-white font-semibold py-3 rounded-sm text-sm hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Joining…" : "Accept Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
