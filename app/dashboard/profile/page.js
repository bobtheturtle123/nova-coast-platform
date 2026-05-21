"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function ProfilePage() {
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");
  const [logoUrl,     setLogoUrl]     = useState("");
  const [form,        setForm]        = useState({
    businessName: "",
    phone:        "",
    ownerName:    "",
  });

  useEffect(() => {
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/dashboard/tenant", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setForm({
            businessName: d.tenant?.businessName || "",
            phone:        d.tenant?.phone        || "",
            ownerName:    d.tenant?.ownerName    || "",
          });
          if (d.tenant?.branding?.logoUrl) setLogoUrl(d.tenant.branding.logoUrl);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          businessName: form.businessName,
          phone:        form.phone,
          ownerName:    form.ownerName,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to save.");
      }
    } catch { setError("Something went wrong."); }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  const email = auth.currentUser?.email || "";

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your business info and contact details</p>
      </div>

      {/* Logo preview */}
      <div className="card p-5 flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt="Company logo" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-[#3486cf]/10 flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-[#0F172A]">{form.businessName || "Your Business"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Logo and branding managed in{" "}
            <Link href="/dashboard/settings" className="text-[#3486cf] hover:underline">Settings → Branding</Link>
          </p>
        </div>
      </div>

      <form onSubmit={save} className="card p-5 space-y-4">
        <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-1">Business Info</p>

        <div>
          <label className="label-field">Business Name</label>
          <input
            className="input-field w-full"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Your company name"
          />
        </div>

        <div>
          <label className="label-field">Contact Phone</label>
          <input
            className="input-field w-full"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+1 (555) 000-0000"
            type="tel"
          />
        </div>

        <div>
          <label className="label-field">Owner / Admin Name</label>
          <input
            className="input-field w-full"
            value={form.ownerName}
            onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="label-field">Login Email</label>
          <input
            className="input-field w-full bg-gray-50 text-gray-400 cursor-default"
            value={email}
            readOnly
          />
          <p className="text-xs text-gray-400 mt-1">Email address cannot be changed here. Contact support if needed.</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </form>
    </div>
  );
}
