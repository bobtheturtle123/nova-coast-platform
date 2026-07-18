"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" /></div>}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const oobCode = params.get("oobCode");

  const [checking, setChecking] = useState(true);
  const [email,    setEmail]    = useState("");
  const [pw,       setPw]       = useState("");
  const [pw2,      setPw2]      = useState("");
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!oobCode) { setError("This reset link is invalid or has expired."); setChecking(false); return; }
    verifyPasswordResetCode(auth, oobCode)
      .then((em) => setEmail(em))
      .catch(() => setError("This reset link is invalid or has expired. Please request a new one."))
      .finally(() => setChecking(false));
  }, [oobCode]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, pw);
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch (err) {
      setError(err?.code === "auth/weak-password" ? "Please choose a stronger password." : "Couldn't reset your password. The link may have expired — request a new one.");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "Georgia, serif" }}>Reset your password</h1>

        {checking ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" /></div>
        ) : done ? (
          <div className="py-6 text-center">
            <p className="text-emerald-600 font-semibold mb-1">Password updated ✓</p>
            <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
          </div>
        ) : error && !email ? (
          <div className="py-4">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Link href="/auth/login" className="text-sm text-[#3486cf] font-semibold">← Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-500">Choose a new password for <strong>{email}</strong>.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">New password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30" placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm new password</label>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30" placeholder="Re-enter password" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full bg-[#3486cf] text-white font-semibold py-2.5 rounded-lg hover:bg-[#2a6dab] transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
