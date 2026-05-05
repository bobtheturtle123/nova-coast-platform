"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult();

      if (!token.claims.admin) {
        setError("Access denied.");
        await auth.signOut();
        return;
      }

      router.push("/admin");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#3486cf] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-white text-2xl tracking-wide">NOVA COAST</p>
          <p className="text-gold/70 text-sm font-body mt-1">Admin Portal</p>
        </div>

        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="block text-sm font-body font-medium text-[#0F172A] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-body font-medium text-[#0F172A] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {error && <p className="text-red-600 text-sm font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
