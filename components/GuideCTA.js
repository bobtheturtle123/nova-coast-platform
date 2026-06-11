"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Bottom-of-guide call to action. Signed-OUT visitors get the "start free"
// sign-up CTA; signed-IN tenants get a quieter "back to dashboard" instead of
// being asked to sign up for something they already have.
export default function GuideCTA() {
  const [signedIn, setSignedIn] = useState(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);

  if (signedIn) {
    return (
      <div className="mt-10 bg-[#0F172A] rounded-2xl p-8 text-center">
        <p className="text-white text-lg font-semibold mb-1">Need anything else?</p>
        <p className="text-white/60 text-sm mb-5">Jump back into your dashboard to keep working.</p>
        <Link href="/dashboard"
          className="inline-block bg-white text-[#0F172A] font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          Back to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 bg-[#0F172A] rounded-2xl p-8 text-center">
      <p className="text-white text-lg font-semibold mb-1">Ready to get started?</p>
      <p className="text-white/60 text-sm mb-5">Set up your studio in minutes and take your first booking.</p>
      <Link href="/auth/register"
        className="inline-block bg-white text-[#0F172A] font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
        Start free →
      </Link>
    </div>
  );
}
