"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);

      // 2. Call server to create tenant + set custom claims
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid:          cred.user.uid,
          email:        form.email,
          businessName: form.businessName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      // 3. Force token refresh to pick up new claims
      await cred.user.getIdToken(true);

      // 4. Go to onboarding
      router.push("/onboarding");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-navy text-2xl tracking-wide">NovaOS</Link>
          <p className="text-gray-500 text-sm mt-2">Create your account — 14 days free</p>
        </div>

        <div className="bg-white rounded-sm border border-gray-200 p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={set("businessName")}
                required
                className="input-field w-full"
                placeholder="Nova Coast Media"
              />
              <p className="text-xs text-gray-400 mt-1">This becomes your booking URL.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                className="input-field w-full"
                placeholder="you@yourcompany.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                className="input-field w-full"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                required
                className="input-field w-full"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-navy font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
