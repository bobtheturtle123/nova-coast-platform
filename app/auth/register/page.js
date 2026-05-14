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
    phone: "",
    password: "",
    confirm: "",
    accessCode: "",
  });
  const [smsConsent,  setSmsConsent]  = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showCode,    setShowCode]    = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 4)  return digits;
    if (digits.length < 7)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const errs = {};
    const phoneDigits = form.phone.replace(/\D/g, "").length;
    if (phoneDigits > 0 && phoneDigits < 10) errs.phone = "Enter a valid 10-digit phone number";
    if (phoneDigits >= 10 && !smsConsent)    errs.smsConsent = "Please check the SMS consent box to continue.";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

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
      // credentials:"include" is required so the referral cookie set by /ref/[code] is sent
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid:          cred.user.uid,
          email:        form.email,
          businessName: form.businessName,
          phone:        form.phone || undefined,
          accessCode:   form.accessCode.trim() || undefined,
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
        setError("An account with this email already exists. Try signing in instead.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts from this device. Please wait a few minutes and try again, or reset your password.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
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
          <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-12 w-auto object-contain mx-auto" />
          <p className="text-gray-500 text-sm mt-2">Create your account</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
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
                placeholder="Your Business Name"
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
            {/* Phone — optional, triggers SMS consent when filled */}
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                Phone <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                className={`input-field w-full ${fieldErrors.phone ? "border-red-300" : ""}`}
                placeholder="(619) 555-0100"
              />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>

            {/* SMS consent — always visible per Twilio compliance */}
            <div className="space-y-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => {
                    setSmsConsent(e.target.checked);
                    if (e.target.checked) setFieldErrors((err) => { const n = { ...err }; delete n.smsConsent; return n; });
                  }}
                  className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-gray-300 text-[#3486cf] focus:ring-navy"
                />
                <span className="text-sm text-gray-600">
                  I agree to receive SMS text messages from KyoriaOS related to bookings, appointment reminders, and media delivery notifications.
                </span>
              </label>
              <p className="text-xs text-gray-400 ml-7">
                Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance.
              </p>
              {fieldErrors.smsConsent && (
                <p className="text-xs text-red-500 ml-7">{fieldErrors.smsConsent}</p>
              )}
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

            <div>
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showCode ? "▾ Hide access code" : "▸ Have an access code?"}
              </button>
              {showCode && (
                <input
                  type="text"
                  value={form.accessCode}
                  onChange={set("accessCode")}
                  className="input-field w-full mt-2"
                  placeholder="Enter your access code"
                  autoComplete="off"
                />
              )}
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
            <Link href="/auth/login" className="text-[#3486cf] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
