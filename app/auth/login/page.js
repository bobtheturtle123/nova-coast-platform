"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [mode,     setMode]     = useState("login"); // "login" | "reset"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [info,     setInfo]     = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred  = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult();
      if (token.claims.role === "superadmin") {
        router.push("/superadmin");
      } else if (token.claims.tenantId) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Incorrect email or password. Try again or reset your password below.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please reset your password or wait a few minutes before trying again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Reset link sent — check your inbox (and spam folder).");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Don't reveal whether account exists
        setInfo("If that email is registered, a reset link is on its way.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else {
        setError("Couldn't send reset email. Please try again.");
      }
    }
    setLoading(false);
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setInfo("");
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-14 w-auto object-contain mx-auto mb-2" />
          <p className="text-gray-500 text-sm mt-1.5">
            {mode === "login" ? "Sign in to your account" : "Reset your password"}
          </p>
        </div>

        <div className="card p-8">

          {/* Error / info banners */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">
              {info}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label-field">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="you@yourcompany.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label-field mb-0">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-xs text-gray-400 hover:text-[#3486cf] transition-colors">
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="label-field">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="you@yourcompany.com"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  We'll send a reset link to this address if an account exists.
                </p>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-sm text-gray-500 hover:text-[#3486cf] transition-colors text-center">
                ← Back to sign in
              </button>
            </form>
          )}

          {mode === "login" && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{" "}
              <Link href="/auth/register" className="text-[#3486cf] font-medium hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
