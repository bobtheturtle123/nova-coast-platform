"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";

export default function AgentLoginPage() {
  const { slug }  = useParams();
  const router    = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(true); // start true while checking existing session
  const [resetSent, setResetSent] = useState(false);

  // If Firebase Auth already has an active session, set the cookie and redirect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch(`/api/${slug}/agent/session`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body:    JSON.stringify({}),
          });
          if (res.ok) { router.replace(`/${slug}/agent`); return; }
        } catch {}
      }
      setLoading(false);
    });
    return unsub;
  }, [slug, router]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const cred    = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const res     = await fetch(`/api/${slug}/agent/session`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No agent account found for this email.");
        setLoading(false);
        return;
      }
      router.replace(`/${slug}/agent`);
    } catch (err) {
      const msg = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Invalid email or password."
        : err.code === "auth/user-not-found"
          ? "No account found. Use the invite link from your photographer to get started."
          : "Sign-in failed. Try again.";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) { setError("Enter your email first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch {
      setError("Could not send reset email. Check your email address.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Sign In</h1>
      <p className="text-sm text-gray-400 mb-8">Access your agent portal</p>

      {resetSent ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          Password reset email sent to <strong>{email}</strong>. Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <input
            type="password" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-[#3486cf] hover:bg-[#2a72b8] disabled:opacity-50 transition-colors">
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <button
            type="button" onClick={handleReset}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">
            Forgot password?
          </button>
        </form>
      )}

      <p className="text-xs text-gray-400 mt-10 text-center leading-relaxed">
        Don&apos;t have an account? Use the invite link sent by your photographer.
      </p>
    </div>
  );
}
