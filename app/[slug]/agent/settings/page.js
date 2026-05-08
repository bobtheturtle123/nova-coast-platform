"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

function AgentSettingsInner() {
  const { slug } = useParams();
  const router   = useRouter();

  const [agent,     setAgent]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [phone,     setPhone]     = useState("");
  const [saved,     setSaved]     = useState(false);

  // Password change state
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwMsg,      setPwMsg]      = useState(null); // { type: 'success'|'error', text }
  const [pwLoading,  setPwLoading]  = useState(false);

  // Reset password state
  const [resetSent,  setResetSent]  = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/${slug}/agent/session`)
      .then((r) => {
        if (r.status === 401) { router.replace(`/${slug}/agent/login`); return null; }
        return r.json();
      })
      .then((d) => {
        if (d?.agent) {
          setAgent(d.agent);
          setPhone(d.agent.phone || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, router]);

  // Need token for profile PATCH — fetch it separately from session
  const [accessToken, setAccessToken] = useState("");
  useEffect(() => {
    // The session cookie holds the UUID token server-side; we can't read httpOnly cookies.
    // Instead, call the session API which returns the token for in-page API calls.
    fetch(`/api/${slug}/agent/session`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.accessToken) setAccessToken(d.accessToken); })
      .catch(() => {});
  }, [slug]);

  async function saveProfile() {
    if (!accessToken) return;
    const res = await fetch(`/api/${slug}/agent/me`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token: accessToken, phone }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "New passwords don't match." }); return; }
    if (newPw.length < 8)   { setPwMsg({ type: "error", text: "Password must be at least 8 characters." }); return; }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const { auth }  = await import("@/lib/firebase");
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
      const user      = auth.currentUser;
      if (!user) { setPwMsg({ type: "error", text: "Not signed in. Please log in again." }); setPwLoading(false); return; }
      const cred      = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      setPwMsg({ type: "success", text: "Password updated." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
        ? "Current password is incorrect."
        : err.message || "Failed to update password.";
      setPwMsg({ type: "error", text: msg });
    }
    setPwLoading(false);
  }

  async function sendResetEmail() {
    if (!agent?.email) return;
    setResetLoading(true);
    try {
      const { auth }                = await import("@/lib/firebase");
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, agent.email);
      setResetSent(true);
    } catch {
      setPwMsg({ type: "error", text: "Could not send reset email." });
    }
    setResetLoading(false);
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
          <button onClick={saveProfile}
            className="text-sm font-semibold px-5 py-2 rounded-lg text-white bg-[#3486cf] hover:bg-[#2a72b8] transition-colors">
            Save Changes
          </button>
          {saved && <p className="text-sm text-emerald-600 font-medium">Saved ✓</p>}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password" required autoComplete="current-password"
            value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Current password"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
          />
          <input
            type="password" required autoComplete="new-password"
            value={newPw} onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
          />
          <input
            type="password" required autoComplete="new-password"
            value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]"
          />
          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
              {pwMsg.text}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pwLoading}
              className="text-sm font-semibold px-5 py-2 rounded-lg text-white bg-[#3486cf] hover:bg-[#2a72b8] disabled:opacity-50 transition-colors">
              {pwLoading ? "Updating…" : "Update Password"}
            </button>
            {!resetSent ? (
              <button type="button" onClick={sendResetEmail} disabled={resetLoading}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                {resetLoading ? "Sending…" : "Send reset email instead"}
              </button>
            ) : (
              <p className="text-sm text-emerald-600">Reset email sent to {agent.email}</p>
            )}
          </div>
        </form>
      </div>

      {/* Account */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Account</h2>
        <p className="text-xs text-gray-400 mb-4">You are signed in as <strong>{agent.email}</strong>.</p>
        <button
          onClick={async () => {
            try { const { auth } = await import("@/lib/firebase"); const { signOut } = await import("firebase/auth"); await signOut(auth).catch(() => {}); } catch {}
            await fetch(`/api/${slug}/agent/session`, { method: "DELETE" }).catch(() => {});
            router.replace(`/${slug}/agent/login`);
          }}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Sign Out
        </button>
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
