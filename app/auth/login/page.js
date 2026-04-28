"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
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
        // Account exists but onboarding incomplete
        router.push("/onboarding");
      }
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-white text-base" style={{ background: "linear-gradient(135deg, #0e2f5a, #091e3e)" }}>K</div>
          <Link href="/" className="font-semibold text-[#0F172A] text-xl tracking-tight">KyoriaOS</Link>
          <p className="text-gray-500 text-sm mt-1.5">Sign in to your account</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                <label className="label-field">Password</label>
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

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{" "}
            <Link href="/auth/register" className="text-navy font-medium hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
