"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";
import { ZONE_COLORS } from "@/lib/zoneColors";

const PRESET_COLORS = ["#3486cf", "#1e6091", "#C9A96E", "#059669", "#8B5CF6", "#EC4899", "#F59E0B", "#DC2626"];

export default function BrandingStep() {
  const router = useRouter();
  const { tenant, setTenant, onboarding, saveOnboarding, patch } = useOnboarding();

  const [name,          setName]         = useState(tenant?.branding?.name || tenant?.businessName || "");
  const [primaryColor,  setPrimaryColor] = useState(tenant?.branding?.primaryColor || "#3486cf");
  const [logoUrl,       setLogoUrl]      = useState(tenant?.branding?.logoUrl || "");
  const [hexInput,      setHexInput]     = useState(tenant?.branding?.primaryColor || "#3486cf");
  const [uploading,     setUploading]    = useState(false);
  const [saving,        setSaving]       = useState(false);
  const [error,         setError]        = useState("");
  const dropRef   = useRef(null);
  const fileRef   = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleColorChange(hex) {
    setPrimaryColor(hex);
    setHexInput(hex);
  }

  function handleHexInput(val) {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) setPrimaryColor(val);
  }

  const autoSave = useCallback(async () => {
    if (!name.trim()) return;
    const branding = { name: name.trim(), primaryColor, logoUrl: logoUrl || null };
    await patch({ businessName: name.trim(), branding }).catch(() => {});
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), branding: true },
      currentStep: 2,
    });
    setTenant(t => t ? { ...t, branding, businessName: name.trim() } : t);
  }, [name, primaryColor, logoUrl, onboarding, patch, saveOnboarding, setTenant]);

  async function uploadLogo(file) {
    if (!file || file.size > 2 * 1024 * 1024) { setError("Logo must be under 2 MB."); return; }
    setUploading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch("/api/dashboard/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: "branding" }),
      });
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setLogoUrl(publicUrl);
      // Persist immediately so the logo survives navigation without clicking Continue
      if (name.trim()) {
        patch({ businessName: name.trim(), branding: { name: name.trim(), primaryColor, logoUrl: publicUrl } }).catch(() => {});
      }
    } catch { setError("Logo upload failed."); }
    setUploading(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadLogo(file);
  }

  async function handleContinue() {
    if (!name.trim()) { setError("Studio name is required."); return; }
    setSaving(true); setError("");
    try {
      const branding = { name: name.trim(), primaryColor, logoUrl: logoUrl || null };
      await patch({ businessName: name.trim(), branding });
      await saveOnboarding({
        completed: { ...(onboarding?.completed || {}), branding: true },
        currentStep: 2,
        startedAt: onboarding?.startedAt || new Date().toISOString(),
      });
      router.push("/onboarding/stripe");
    } catch { setError("Couldn't save. Try again."); }
    setSaving(false);
  }

  return (
    <StepCard
      eyebrow="Step 1 of 5 · Branding"
      headline="Make it yours"
      lede="Your studio name, logo, and brand color appear on your booking page, client emails, and galleries."
      footer={
        <>
          <span />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" onClick={() => router.push("/onboarding/stripe")}>
              Skip for now
            </button>
            <button
              className="btn-primary"
              onClick={handleContinue}
              disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Continue → Stripe"}
            </button>
          </div>
        </>
      }
    >
      {error && (
        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }} className="sm:grid-cols-1 md:grid-cols-2">

        {/* ── Left: form ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Studio name */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>
              Studio name <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={autoSave}
              placeholder="Nova Coast Media"
              style={{ width: "100%", height: 42, padding: "0 14px", fontSize: 14, border: "1px solid #E9ECF0", borderRadius: 10, outline: "none", background: "#fff", color: "#0F172A", fontFamily: "inherit" }}
              onFocus={e => { e.target.style.borderColor = "#3486cf"; e.target.style.boxShadow = "0 0 0 3px rgba(52,134,207,0.12)"; }}
              onBlurCapture={e => { e.target.style.borderColor = "#E9ECF0"; e.target.style.boxShadow = "none"; }}
            />
          </div>

          {/* Logo upload */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>
              Logo <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>PNG / JPG / SVG · max 2 MB</span>
            </label>
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
              style={{
                height: logoUrl ? "auto" : 100, border: `2px dashed ${dragging ? "#3486cf" : "#E9ECF0"}`,
                borderRadius: 12, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: dragging ? "#EEF4FA" : "#FAFAFA", transition: "all 0.15s",
                padding: logoUrl ? 12 : 0,
              }}>
              {logoUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={logoUrl} alt="Logo" style={{ height: 48, objectFit: "contain", borderRadius: 6, border: "1px solid #E9ECF0" }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#0F172A" }}>Logo uploaded</p>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                        style={{ fontSize: 11.5, color: "#3486cf", border: "none", background: "none", cursor: "pointer", padding: 0 }}>Replace</button>
                      <button type="button" onClick={e => { e.stopPropagation(); setLogoUrl(""); }}
                        style={{ fontSize: 11.5, color: "#DC2626", border: "none", background: "none", cursor: "pointer", padding: 0 }}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                    {uploading ? "Uploading…" : "Drag & drop or click to upload"}
                  </p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </div>

          {/* Brand color */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>Brand color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => handleColorChange(c)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                    transform: primaryColor === c ? "scale(1.15)" : "scale(1)",
                    boxShadow: primaryColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none",
                    transition: "all 0.12s",
                  }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E9ECF0", overflow: "hidden", flexShrink: 0 }}>
                <input type="color" value={primaryColor} onChange={e => handleColorChange(e.target.value)}
                  style={{ width: 44, height: 44, margin: "-4px", cursor: "pointer", border: "none" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #E9ECF0", borderRadius: 8, overflow: "hidden", height: 36 }}>
                <span style={{ padding: "0 10px", fontSize: 13, color: "#9CA3AF", borderRight: "1px solid #E9ECF0", background: "#FAFAFA" }}>#</span>
                <input
                  type="text"
                  value={hexInput.replace("#", "")}
                  onChange={e => handleHexInput("#" + e.target.value)}
                  style={{ width: 80, padding: "0 10px", fontSize: 13, border: "none", outline: "none", fontFamily: "monospace", color: "#0F172A" }}
                  maxLength={6}
                />
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: primaryColor, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* ── Right: live preview ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase" }}>Live preview</p>

          {/* Booking page mock */}
          <div style={{ border: "1px solid #E9ECF0", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
            <div style={{ height: 6, background: primaryColor }} />
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, background: "#fff" }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{ height: 36, objectFit: "contain" }} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    {(name || "K")[0].toUpperCase()}
                  </div>
              }
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{name || "Your Studio"}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6B7280" }}>Book a session</p>
              </div>
            </div>
            <div style={{ padding: "12px 20px", background: "#F8F7F4", borderTop: "1px solid #F0EDE5" }}>
              <div style={{ height: 8, width: "60%", borderRadius: 4, background: "#E5E7EB" }} />
              <div style={{ height: 8, width: "40%", borderRadius: 4, background: "#E5E7EB", marginTop: 6 }} />
              <div style={{ marginTop: 12, display: "inline-flex", padding: "7px 14px", borderRadius: 8, background: primaryColor, color: "#fff", fontSize: 12, fontWeight: 600 }}>
                Book now
              </div>
            </div>
          </div>

          {/* Gallery email mock */}
          <div style={{ border: "1px solid #E9ECF0", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0EDE5", background: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: "contain" }} />
                : <div style={{ width: 28, height: 28, borderRadius: 6, background: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>
                    {(name || "K")[0].toUpperCase()}
                  </div>
              }
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{name || "Your Studio"}</span>
            </div>
            <div style={{ padding: "16px 20px", background: "#fff" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#0F172A", fontWeight: 600 }}>Your gallery is ready</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280" }}>Click below to view and download your photos.</p>
              <div style={{ marginTop: 12, display: "inline-flex", padding: "7px 14px", borderRadius: 8, background: primaryColor, color: "#fff", fontSize: 12, fontWeight: 600 }}>
                View gallery
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  );
}
