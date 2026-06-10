"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Back link for guide pages. A signed-in tenant returns to their dashboard; a
// public visitor returns to the marketing homepage. Guides are public pages, so
// this keeps the "back" action correct for both audiences.
export default function GuideBackLink({ className = "text-sm text-[#3486cf] hover:underline" }) {
  const [signedIn, setSignedIn] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedIn(!!u));
    return unsub;
  }, []);

  // Until we know, default to the neutral marketing label to avoid a flash.
  if (signedIn) return <Link href="/dashboard" className={className}>← Back to dashboard</Link>;
  return <Link href="/" className={className}>← Back to KyoriaOS</Link>;
}
