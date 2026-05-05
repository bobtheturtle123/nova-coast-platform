"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";
import { getAppUrl } from "@/lib/appUrl";

export default function PhotographerProfilePage() {
  const toast = useToast();
  const [member,  setMember]  = useState(null);
  const [branding, setBranding] = useState(null);
  const [form,    setForm]    = useState({ name: "", phone: "" });
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);

  const APP_URL = getAppUrl();

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/photographer/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMember(data.member || null);
      setBranding(data.branding || null);
      setForm({ name: data.member?.name || "", phone: data.member?.phone || "" });
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/photographer/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: form.name, phone: form.phone }),
    });
    setSaving(false);
    toast("Profile saved.");
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const feedUrl = member?.calendarToken ? `${APP_URL}/api/calendar/${member.calendarToken}` : null;
  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;
  const gcalUrl = feedUrl
    ? `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}`
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="font-bold text-2xl text-gray-900">My Profile</h1>

      {/* Company info */}
      {branding?.businessName && (
        <div className="bg-[#3486cf]/5 border border-[#3486cf]/10 rounded-lg px-4 py-3 flex items-center gap-3">
          {branding.logoUrl && <img src={branding.logoUrl} alt="" className="h-8 object-contain" />}
          <div>
            <p className="text-sm font-semibold text-[#3486cf]">{branding.businessName}</p>
            <p className="text-xs text-gray-400">You&apos;re a photographer on this team</p>
          </div>
        </div>
      )}

      {/* Edit form */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Personal Info</h2>
        </div>
        <form onSubmit={saveProfile} className="p-5 space-y-4">
          <div>
            <label className="label-field">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="Your full name" />
          </div>
          <div>
            <label className="label-field">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input-field w-full" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" value={member?.email || ""} disabled className="input-field w-full opacity-60 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-0.5">Contact your company admin to change your email.</p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2 text-sm">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Pay rate (read-only) */}
      {member?.payRate != null && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Contractor Rate</h2>
          </div>
          <div className="p-5">
            <p className="text-3xl font-bold text-gray-900">${Number(member.payRate).toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-1">per shoot (set by your company admin)</p>
          </div>
        </div>
      )}

      {/* Calendar subscribe */}
      {feedUrl && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Subscribe to My Schedule</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add your assigned shoots to your personal calendar app.</p>
          </div>
          <div className="p-5 space-y-3">
            <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 w-full border border-gray-200 rounded px-4 py-3 hover:bg-gray-50 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="2" fill="#4285F4"/>
                <path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/>
                <path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Add to Google Calendar</p>
                <p className="text-xs text-gray-400">Opens Google Calendar</p>
              </div>
            </a>
            <a href={webcalUrl}
              className="flex items-center gap-3 w-full border border-gray-200 rounded px-4 py-3 hover:bg-gray-50 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="2" fill="#1c1c1e"/>
                <rect x="4" y="5" width="16" height="15" rx="1.5" fill="white"/>
                <rect x="4" y="5" width="16" height="4" rx="1.5" fill="#F44336"/>
                <path d="M8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z" fill="#1c1c1e"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Add to Apple Calendar</p>
                <p className="text-xs text-gray-400">Opens via webcal://</p>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
