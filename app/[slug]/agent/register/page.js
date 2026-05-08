"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

function RegisterInner() {
  const { slug }      = useParams();
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const inviteToken   = searchParams.get("token");

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [verified, setVerified] = useState(false); // invite token verified
  const [checking, setChecking] = useState(!!inviteToken);

  // Verify invite token and pre-fill email
  useEffect(() => {
    if (!inviteToken) { setChecking(false); return; }
    fetch(`/api/${slug}/agent/me?token=${inviteToken}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.agent) {
          setEmail(d.agent.email || "");
          setName(d.agent.name  || "");
          setVerified(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [inviteToken, slug]);

  async function handleRegister(e) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      // Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      const idToken = await cred.user.getIdToken();

      // Set session cookie (Firebase Auth path)
      const res  = await fetch(`/api/${slug}/agent/session`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not set up your account. Contact your photographer.");
        setLoading(false);
        return;
      }
      router.replace(`/${slug}/agent`);
    } catch (err) {
      const msg =
        err.code === "auth/email-already-in-use"
          ? "An account with this email already exists. Try signing in instead."
          : err.code === "auth/weak-password"
            ? "Password is too weak. Use at least 8 characters."
            : err.message || "Registration failed. Try again.";
      setError(msg);
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex justify-center pt-32">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!inviteToken && !verified) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-4">🔗</p>
        <p className="text-gray-700 font-medium mb-2">Invite Link Required</p>
        <p className="text-gray-400 text-sm mb-6">
          You need an invite link from your photographer to create an account. Check your email.
        </p>
        <Link href={`/${slug}/agent/login`} className="text-sm text-[#3486cf] hover:underline">
          Already have an account? Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create Account</h1>
      <p className="text-sm text-gray-400 mb-8">Set up your agent portal access</p>

      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text" required autoComplete="name"
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          readOnly={verified}
          className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${verified ? "bg-gray-50 text-gray-500 cursor-default" : ""}`}
        />
        <div>
          <input
            type="password" required autoComplete="new-password" minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-[#3486cf] hover:bg-[#2a72b8] disabled:opacity-50 transition-colors">
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Already have an account?{" "}
        <Link href={`/${slug}/agent/login`} className="text-[#3486cf] hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

export default function AgentRegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center pt-32">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}
