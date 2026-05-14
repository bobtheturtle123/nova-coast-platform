"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";

const DEFAULT_PREFS = { readAvailability: true, writeBookings: true, syncBlocks: false };

const PREF_DEFS = [
  {
    key:   "readAvailability",
    label: "Use my calendar for availability",
    desc:  "KyoriaOS reads your Google Calendar busy times to prevent double-booking",
    icon:  "📅",
  },
  {
    key:   "writeBookings",
    label: "Add bookings to my calendar",
    desc:  "Confirmed shoots are automatically added to your Google Calendar",
    icon:  "✅",
  },
  {
    key:   "syncBlocks",
    label: "Sync blocked time to my calendar",
    desc:  "Time blocks created in KyoriaOS appear as events in your Google Calendar",
    icon:  "🔒",
  },
];

export default function PhotographerProfilePage() {
  const toast = useToast();

  const [member,       setMember]       = useState(null);
  const [branding,     setBranding]     = useState(null);
  const [form,         setForm]         = useState({ name: "", phone: "" });
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);

  // Calendar sync state
  const [prefs,        setPrefs]        = useState(DEFAULT_PREFS);
  const [savingPrefs,  setSavingPrefs]  = useState(false);
  const [prefSaved,    setPrefSaved]    = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [calError,     setCalError]     = useState("");

  const loadProfile = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res  = await fetch("/api/photographer/me", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setMember(data.member || null);
    setBranding(data.branding || null);
    setForm({ name: data.member?.name || "", phone: data.member?.phone || "" });
    setPrefs(data.member?.calendarPrefs || DEFAULT_PREFS);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/photographer/me", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ name: form.name, phone: form.phone }),
    });
    setSaving(false);
    toast("Profile saved.");
  }

  // ── Calendar Sync ──────────────────────────────────────────────────────────

  const isConnected = !!member?.googleCalendar?.connected;
  const lastSynced  = member?.googleCalendar?.lastSynced;

  function connectCalendar() {
    setCalError("");
    auth.currentUser?.getIdToken().then((token) => {
      if (!member?.id) { setCalError("Profile not loaded. Please refresh."); return; }
      const url    = `/api/calendar/oauth/start?token=${token}`;
      const popup  = window.open(url, "gcal-oauth", "width=600,height=700,noopener");
      const handler = (e) => {
        if (e.data?.type === "gcal-connected") {
          window.removeEventListener("message", handler);
          popup?.close();
          loadProfile();
          toast("Google Calendar connected!");
        } else if (e.data?.type === "gcal-error") {
          window.removeEventListener("message", handler);
          setCalError(e.data.error || "Connection failed. Please try again.");
        }
      };
      window.addEventListener("message", handler);
    });
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    setCalError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/photographer/me/calendar", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) { setCalError(d.error || "Sync failed"); }
      else {
        setSyncResult(d.synced ?? 0);
        setMember((m) => ({ ...m, googleCalendar: { ...m.googleCalendar, lastSynced: new Date().toISOString() } }));
        toast("Calendar synced.");
      }
    } catch (e) { setCalError(e.message); }
    setSyncing(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar?")) return;
    setDisconnecting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch("/api/photographer/me/calendar", {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMember((m) => ({ ...m, googleCalendar: { connected: false } }));
      setSyncResult(null);
      toast("Google Calendar disconnected.");
    } catch (e) { setCalError(e.message); }
    setDisconnecting(false);
  }

  async function togglePref(key) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSavingPrefs(true);
    setPrefSaved(false);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch("/api/photographer/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ calendarPrefs: newPrefs }),
      });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2000);
    } catch {}
    setSavingPrefs(false);
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const canViewPayRate = member?.permissions?.canViewRevenue !== false;

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

      {/* Personal info form */}
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

      {/* Pay rate — only if admin granted visibility */}
      {member?.payRate != null && canViewPayRate && (
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

      {/* ── Calendar Sync ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Calendar Sync</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Connect your Google Calendar so KyoriaOS can read your availability and push booked shoots.
          </p>
        </div>

        <div className="p-5 space-y-4">

          {calError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {calError}
            </div>
          )}

          {/* Connection hero */}
          {isConnected ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-green-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Google Calendar connected</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {lastSynced
                        ? `Last synced ${new Date(lastSynced).toLocaleString()}`
                        : "Not yet synced"}
                      {syncResult !== null && (
                        <span className="ml-1.5 font-medium">· {syncResult} busy block{syncResult !== 1 ? "s" : ""} imported</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="flex-shrink-0 text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium transition-colors">
                  {syncing ? "Syncing…" : "Sync Now"}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#3486cf]/25 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#4285F4] flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 mb-1">Connect your Google Calendar</p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed max-w-xs mx-auto">
                Let the booking system read your busy times to prevent double-bookings. Confirmed shoots will automatically appear in your calendar.
              </p>
              <button onClick={connectCalendar} className="btn-primary px-6 py-2 text-sm inline-flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
                </svg>
                Connect with Google
              </button>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: "🔗", label: "Connect once" },
                  { icon: "📅", label: "Reads busy times" },
                  { icon: "✅", label: "No double-bookings" },
                ].map(({ icon, label }) => (
                  <div key={label} className="bg-gray-50 rounded-lg py-2.5 px-2">
                    <p className="text-base mb-0.5">{icon}</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync preferences — only when connected */}
          {isConnected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800">Sync Preferences</p>
                {prefSaved  && <span className="text-xs text-green-600 font-medium">Saved</span>}
                {savingPrefs && !prefSaved && <span className="text-xs text-gray-400">Saving…</span>}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {PREF_DEFS.map(({ key, label, desc, icon }) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => togglePref(key)}
                      disabled={savingPrefs}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${
                        prefs[key] ? "bg-[#3486cf]" : "bg-gray-200"
                      }`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        prefs[key] ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reconnect / Disconnect */}
          {isConnected && (
            <div className="flex items-center justify-between pt-1">
              <button onClick={connectCalendar} className="text-xs text-[#3486cf] hover:underline">
                Reconnect
              </button>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
