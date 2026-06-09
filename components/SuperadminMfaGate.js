"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

// Wraps superadmin surfaces with an email one-time-code second factor. Children
// render only after the superadmin has a current 2FA session. The data APIs are
// independently protected server-side (isSuperAdminVerified), so this is the UX
// layer on top of that hard gate.
export default function SuperadminMfaGate({ children, onVerified }) {
  const [state, setState] = useState("checking"); // checking | locked | ok | error
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [code, setCode]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState("");

  const token = useCallback(() => auth.currentUser?.getIdToken(), []);

  const check = useCallback(async () => {
    try {
      const t = await token();
      if (!t) { setState("locked"); return; }
      const res = await fetch("/api/superadmin/2fa/status", { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) { setState("error"); return; }
      const d = await res.json();
      setEmail(d.email || "");
      if (d.verified) { setState("ok"); onVerified?.(); }
      else setState("locked");
    } catch { setState("error"); }
  }, [token, onVerified]);

  useEffect(() => { check(); }, [check]);

  async function sendCode() {
    setBusy(true); setMsg("");
    try {
      const t = await token();
      const res = await fetch("/api/superadmin/2fa/send", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      if (res.ok) { setSent(true); setMsg(`Code sent to ${d.sentTo || email}.`); }
      else setMsg(d.error || "Could not send the code.");
    } catch { setMsg("Could not send the code."); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMsg("");
    try {
      const t = await token();
      const res = await fetch("/api/superadmin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (res.ok) { setState("ok"); onVerified?.(); }
      else setMsg(d.error || "Incorrect code.");
    } catch { setMsg("Verification failed."); }
    finally { setBusy(false); }
  }

  if (state === "ok") return children;

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-7 max-w-sm w-full">
        <h1 className="text-lg font-bold text-gray-900 mb-1">Verify it's you</h1>
        <p className="text-sm text-gray-500 mb-5">
          Superadmin tools expose tenant data, so they require a second step.
          {email ? <> We'll email a 6-digit code to <strong>{email}</strong>.</> : null}
        </p>

        {state === "error" && (
          <p className="text-sm text-red-600 mb-4">Could not confirm your access. Make sure you're signed in as the owner.</p>
        )}

        {!sent ? (
          <button onClick={sendCode} disabled={busy}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-60">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        ) : (
          <>
            <input
              inputMode="numeric" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full text-center tracking-[8px] text-2xl font-bold border border-gray-200 rounded-xl py-3 mb-3 outline-none focus:border-[#3486cf]" />
            <button onClick={verify} disabled={busy || code.length !== 6}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-60">
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button onClick={sendCode} disabled={busy}
              className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600">
              Resend code
            </button>
          </>
        )}

        {msg && <p className="text-xs text-gray-500 mt-3 text-center">{msg}</p>}
      </div>
    </div>
  );
}
