"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/onboarding/branding"); }, [router]);
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );
}
