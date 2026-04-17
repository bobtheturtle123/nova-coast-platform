"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ROLE_LABELS = { admin: "Admin", manager: "Manager" };

export default function StaffInviteClient({ token, tenantId, companyName, inviteEmail, role }) {
  const [mode,       setMode]       = useState("signup"); // "signup" | "login"
  const [email,      setEmail]      = useState(inviteEmail || "");
  const [password,   setPassword]   = useState("");
  const [password2,  setPassword2]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    if (mode === "signup" && password !== password2) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSubmitting(true);
    setError("");

    try {
      let userCred;
      if (mode === "signup") {
        userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      const idToken = await userCred.user.getIdToken();
      const res = await fetch(`/api/staff-invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userCred.user.uid, email: userCred.user.email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setSubmitting(false); return; }

      // Force token refresh so new claims are picked up
      await userCred.user.getIdToken(true);
      setDone(true);
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-navy mb-2">Access granted!</h1>
          <p className="text-gray-500 text-sm mb-6">
            You now have <strong>{ROLE_LABELS[role] || role}</strong> access to <strong>{companyName}</strong>.
          </p>
          <a href="/dashboard"
            className="inline-block bg-navy text-white font-semibold py-3 px-8 rounded-sm text-sm hover:bg-navy/90 transition-colors">
            Go to Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="p-8 pb-0 text-center">
          <div className="w-14 h-14 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#0b2a55" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-navy mb-1">Join {companyName}</h1>
          <p className="text-sm text-gray-500 mb-1">
            You&apos;ve been invited as <span className="font-semibold text-charcoal">{ROLE_LABELS[role] || role}</span>
          </p>
          <p className="text-xs text-gray-400 mb-6">Create an account or sign in to accept.</p>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-200 -mx-1 mb-0">
            {["signup", "login"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  mode === m ? "border-navy text-navy" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                {m === "signup" ? "Create Account" : "Sign In"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors"
              placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors"
              placeholder="Min. 6 characters" required />
          </div>
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input type="password" value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-navy/60 transition-colors"
                placeholder="Repeat password" required />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={submitting}
            className="w-full bg-navy text-white font-semibold py-3 rounded-sm text-sm hover:bg-navy/90 transition-colors disabled:opacity-50">
            {submitting ? "Processing…" : mode === "signup" ? "Create Account & Accept" : "Sign In & Accept"}
          </button>
        </form>
      </div>
    </div>
  );
}
