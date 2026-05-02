"use client";

import { useRef, useState, useEffect } from "react";

const TEMPLATES = [
  { id: "just_listed",  label: "Just Listed",   emoji: "🏡", tagline: "Just Listed" },
  { id: "open_house",   label: "Open House",     emoji: "🚪", tagline: "Open House" },
  { id: "story_slide",  label: "Story Slide",    emoji: "📱", tagline: "" },
  { id: "promo_card",   label: "Promo Card",     emoji: "✨", tagline: "" },
];

const SIZES = {
  just_listed: { w: 1080, h: 1080, label: "1080 × 1080" },
  open_house:  { w: 1080, h: 1080, label: "1080 × 1080" },
  story_slide: { w: 1080, h: 1920, label: "1080 × 1920" },
  promo_card:  { w: 1200, h: 628,  label: "1200 × 628" },
};

export default function MarketingStudio({ booking, branding, coverUrl }) {
  const canvasRef  = useRef(null);
  const [template, setTemplate] = useState("just_listed");
  const [headline, setHeadline] = useState(booking?.address || "");
  const [sub,      setSub]      = useState("");
  const [showPrice, setShowPrice] = useState(true);
  const [rendering, setRendering] = useState(false);

  const pw      = booking?.propertyWebsite || {};
  const primary = branding?.primary || "#3486cf";
  const accent  = branding?.accent  || "#c9a96e";
  const bizName = branding?.bizName || "KyoriaOS";

  const price = pw.price || null;
  const beds  = pw.beds  || null;
  const baths = pw.baths || null;
  const sqft  = pw.sqft  || null;

  // Render preview to canvas whenever inputs change
  useEffect(() => {
    drawCanvas();
  }, [template, headline, sub, showPrice, coverUrl]);

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = SIZES[template];
    const SCALE = 0.4; // preview scale
    canvas.width  = size.w * SCALE;
    canvas.height = size.h * SCALE;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext("2d");

    // ── Background ────────────────────────────────────────────────
    if (coverUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, W, H);
        drawOverlay(ctx, W, H, SCALE);
      };
      img.onerror = () => {
        drawSolidBackground(ctx, W, H, SCALE);
      };
      img.src = coverUrl;
    } else {
      drawSolidBackground(ctx, W, H, SCALE);
    }
  }

  function drawSolidBackground(ctx, W, H, SCALE) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, "#0F172A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    drawOverlay(ctx, W, H, SCALE);
  }

  function drawOverlay(ctx, W, H, SCALE) {
    // Dark scrim at bottom
    const scrim = ctx.createLinearGradient(0, H * 0.4, 0, H);
    scrim.addColorStop(0, "rgba(0,0,0,0)");
    scrim.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    const pad = 24 * SCALE;

    // Template tag
    const tmpl = TEMPLATES.find((t) => t.id === template);
    if (tmpl?.tagline) {
      ctx.fillStyle = accent;
      ctx.font      = `bold ${14 * SCALE}px sans-serif`;
      ctx.fillText(tmpl.tagline.toUpperCase(), pad, H * 0.62);
    }

    // Headline
    ctx.fillStyle = "#FFFFFF";
    ctx.font      = `bold ${template === "story_slide" ? 28 * SCALE : 22 * SCALE}px Georgia,serif`;
    wrapText(ctx, headline || "Property Address", pad, H * 0.68, W - pad * 2, 32 * SCALE);

    // Sub / open house date
    if (sub) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font      = `${13 * SCALE}px sans-serif`;
      ctx.fillText(sub, pad, H * 0.78);
    }

    // Stats row
    const stats = [
      beds  && `${beds} bd`,
      baths && `${baths} ba`,
      sqft  && `${Number(sqft).toLocaleString()} sqft`,
    ].filter(Boolean);
    if (stats.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font      = `${11 * SCALE}px sans-serif`;
      ctx.fillText(stats.join("  ·  "), pad, H * 0.84);
    }

    // Price
    if (showPrice && price) {
      ctx.fillStyle = accent;
      ctx.font      = `bold ${18 * SCALE}px sans-serif`;
      ctx.fillText(price, pad, H * 0.91);
    }

    // Biz name watermark
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.font      = `${10 * SCALE}px sans-serif`;
    ctx.fillText(bizName, pad, H - pad);
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = (text || "").split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
  }

  async function download() {
    setRendering(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const size  = SIZES[template];
      const el    = document.getElementById("marketing-studio-preview");
      if (!el) return;

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const link   = document.createElement("a");
      link.download = `${template}-${Date.now()}.png`;
      link.href     = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: download canvas directly
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link   = document.createElement("a");
      link.download = `${template}-${Date.now()}.png`;
      link.href     = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setRendering(false);
    }
  }

  const size = SIZES[template];

  return (
    <div className="space-y-5">
      {/* Template picker */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Template</p>
        <div className="grid grid-cols-4 gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTemplate(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-colors ${
                template === t.id ? "border-[#3486cf] bg-[#EEF5FC]" : "border-gray-200 hover:border-gray-300"
              }`}>
              <span className="text-xl">{t.emoji}</span>
              <span className="text-[11px] font-medium text-gray-700 leading-tight">{t.label}</span>
              <span className="text-[10px] text-gray-400">{SIZES[t.id].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Headline</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30"
            placeholder="Property address or headline" />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Sub-text / Date</label>
          <input value={sub} onChange={(e) => setSub(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30"
            placeholder={template === "open_house" ? "Sunday, May 5 · 1–4 PM" : "Optional subtitle"} />
        </div>
        {price && (
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setShowPrice((v) => !v)}
              className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${showPrice ? "bg-[#3486cf]" : "bg-gray-200"}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showPrice ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-gray-600">Show price ({price})</span>
          </label>
        )}
      </div>

      {/* Preview canvas */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Preview</p>
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center"
          style={{ aspectRatio: `${size.w}/${size.h}` }}>
          <canvas ref={canvasRef}
            id="marketing-studio-preview"
            className="w-full h-auto rounded-xl"
            style={{ maxHeight: "400px", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Download */}
      <button onClick={download} disabled={rendering}
        className="w-full py-3 text-sm font-semibold rounded-xl text-white bg-[#3486cf] hover:bg-[#2a72b8] transition-colors disabled:opacity-50">
        {rendering ? "Generating…" : "↓ Download PNG"}
      </button>
    </div>
  );
}
