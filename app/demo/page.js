"use client";

// Public entry point for the view-only demo workspace.
// Enables demo mode (per-tab) and drops the visitor into the dashboard.

import { useEffect } from "react";
import { enableDemo } from "@/lib/demoData";

export default function DemoEntry() {
  useEffect(() => {
    enableDemo();
    window.location.replace("/dashboard?demo=1");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F7F4" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 22, height: 22, margin: "0 auto 14px", border: "2px solid #E9E7E1", borderTopColor: "#3486cf", borderRadius: "50%", animation: "kyspin 0.8s linear infinite" }} />
        <p style={{ fontFamily: "Inter, sans-serif", color: "#6B7075", fontSize: 14 }}>Loading your demo workspace…</p>
      </div>
      <style>{`@keyframes kyspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
