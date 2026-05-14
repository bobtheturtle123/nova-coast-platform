"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

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
    label: "Add Kyoria bookings to my calendar",
    desc:  "Confirmed shoots are automatically added to your Google Calendar",
    icon:  "✅",
  },
  {
    key:   "syncBlocks",
    label: "Sync blocked time to my calendar",
    desc:  "Time blocks you create in KyoriaOS appear as events in your Google Calendar",
    icon:  "🔒",
  },
];

export default function ProfilePage() {
  const [member,       setMember]       = useState(null);
  const [isOwner,      setIsOwner]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [prefs,        setPrefs]        = useState(DEFAULT_PREFS);
  const [savingPrefs,  setSavingPrefs]  = useState(false);
  const [prefSaved,    setPrefSaved]    = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error,        setError]        = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/dashboard/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.member) {
        setMember(d.member);
        setPrefs(d.member.calendarPrefs || DEFAULT_PREFS);
      } else {
        setIsOwner(true);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const isConnected = !!member?.googleCalendar?.refreshToken;
  const lastSynced  = member?.googleCalendar?.lastSynced;

  function connectCalendar() {
    setError("");
    auth.currentUser?.getIdToken().then((token) => {
      if (!member?.id) { setError("Profile not loaded. Please refresh."); return; }
      const url    = `/api/calendar/oauth/start?token=${token}`;
      const popup  = window.open(url, "gcal-oauth", "width=600,height=700,noopener");
      const handler = (e) => {
        if (e.data?.type === "gcal-connected") {
          window.removeEventListener("message", handler);
          popup?.close();
          loadProfile();
        } else if (e.data?.type === "gcal-error") {
          window.removeEventListener("message", handler);
          setError(e.data.error || "Connection failed. Please try again.");
        }
      };
      window.addEventListener("message", handler);
    });
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? KyoriaOS will no longer read your availability or push bookings.")) return;
    setDisconnecting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch("/api/dashboard/me/calendar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMember((m) => ({ ...m, googleCalendar: {} }));
      setSyncResult(null);
    } catch (e) {
      setError(e.message);
    }
    setDisconnecting(false);
  }

  async function syncNow() {
    if (!member?.id) return;
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ memberId: member.id }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Sync failed"); }
      else {
        setSyncResult(d.synced ?? 0);
        setMember((m) => ({ ...m, googleCalendar: { ...m.googleCalendar, lastSynced: new Date().toISOString() } }));
      }
    } catch (e) { setError(e.message); }
    setSyncing(false);
  }

  async function togglePref(key) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSavingPrefs(true);
    setPrefSaved(false);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch("/api/dashboard/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ calendarPrefs: newPrefs }),
      });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2000);
    } catch {}
    setSavingPrefs(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your personal settings and connected integrations</p>
      </div>

      {/* Identity card */}
      {member && (
        <div className="card flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: member.color || "#3486cf" }}>
            {(member.name || member.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[#0F172A]">{member.name || "(no name)"}</p>
            <p className="text-sm text-gray-500">{member.email}</p>
            <span className="inline-block mt-1 text-[11px] font-medium capitalize px-2 py-0.5 rounded-full bg-[#3486cf]/10 text-[#3486cf]">
              {member.role || "photographer"}
            </span>
          </div>
        </div>
      )}

      {isOwner && !member && (
        <div className="card">
          <p className="text-sm text-gray-500">
            You&apos;re the account owner. Calendar sync is available once your photographer profile is set up in the{" "}
            <a href="/dashboard/team" className="text-[#3486cf] hover:underline">Team page</a>.
          </p>
        </div>
      )}

      {/* ── Calendar Sync ──────────────────────────────────────────────────────── */}
      {member && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-[#0F172A] text-base">Calendar Sync</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect your Google Calendar so KyoriaOS can read your availability and push booked shoots to your calendar.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Connection status */}
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
                        <span className="ml-2 font-medium">· {syncResult} busy block{syncResult !== 1 ? "s" : ""} imported</span>
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
              <p className="font-semibold text-[#0F172A] mb-1">Connect your Google Calendar</p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed max-w-xs mx-auto">
                KyoriaOS will read your busy times to prevent double-booking and automatically add confirmed shoots to your calendar.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button onClick={connectCalendar} className="btn-primary px-6 py-2 text-sm inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
                  </svg>
                  Connect with Google
                </button>
              </div>
              {/* How it works */}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
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

          {/* Sync preferences */}
          {isConnected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#0F172A]">Sync Preferences</p>
                {prefSaved && <span className="text-xs text-green-600 font-medium">Saved</span>}
                {savingPrefs && !prefSaved && <span className="text-xs text-gray-400">Saving…</span>}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                {PREF_DEFS.map(({ key, label, desc, icon }) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A]">{label}</p>
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

          {/* Disconnect */}
          {isConnected && (
            <div className="pt-1 flex justify-end">
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
