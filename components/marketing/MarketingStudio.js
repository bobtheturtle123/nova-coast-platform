"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const TEMPLATES = [
  { id: "just_listed",  label: "Just Listed",  emoji: "🏡", w: 1080, h: 1080 },
  { id: "open_house",   label: "Open House",   emoji: "🚪", w: 1080, h: 1080 },
  { id: "story_slide",  label: "Story",        emoji: "📱", w: 1080, h: 1920 },
  { id: "promo_card",   label: "Promo Card",   emoji: "✨", w: 1200, h: 628  },
];

const PREVIEW_SCALE = 0.38;

// Draw image with object-fit: cover semantics into a destination rect
function drawCover(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.naturalWidth) return;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = dw / dh;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.naturalHeight;
    sw = sh * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 3) {
  const words = (text || "").split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    if (lines >= maxLines) break;
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
      lines++;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

// ── Template: Just Listed ────────────────────────────────────────────────────
// Full-bleed image, clean bottom-panel editorial style
function drawJustListed(ctx, W, H, img, opts) {
  const { headline, sub, price, beds, baths, sqft, primary, accent, bizName, showPrice } = opts;
  const S = W / 1080;

  // Background
  if (img) {
    drawCover(ctx, img, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a2a3a");
    grad.addColorStop(1, "#0F172A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Bottom gradient scrim — starts transparent at 45% height, black at bottom
  const scrim = ctx.createLinearGradient(0, H * 0.38, 0, H);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(0.5, "rgba(0,0,0,0.62)");
  scrim.addColorStop(1, "rgba(0,0,0,0.93)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  const pad = 52 * S;
  let y = H * 0.56;

  // "JUST LISTED" pill badge
  ctx.font = `700 ${11 * S}px sans-serif`;
  ctx.letterSpacing = `${2 * S}px`;
  const badgeText = "JUST LISTED";
  const bw = ctx.measureText(badgeText).width + 28 * S;
  const bh = 24 * S;
  roundRect(ctx, pad, y, bw, bh, 4 * S);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(badgeText, pad + 14 * S, y + bh * 0.72);
  ctx.letterSpacing = "0px";

  y += bh + 20 * S;

  // Accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(pad, y, 42 * S, 3 * S);
  y += 16 * S;

  // Address / headline
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${30 * S}px Georgia, serif`;
  wrapText(ctx, headline || "Property Address", pad, y, W - pad * 2, 40 * S, 2);
  const headlineLines = Math.min(2, Math.ceil(ctx.measureText(headline || "").width / (W - pad * 2)) + 1);
  y += (headlineLines > 1 ? 80 : 42) * S;

  // Sub
  if (sub) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `400 ${14 * S}px sans-serif`;
    ctx.fillText(sub, pad, y);
    y += 26 * S;
  }

  // Stats row
  const stats = [
    beds  && `${beds} bd`,
    baths && `${baths} ba`,
    sqft  && `${Number(sqft).toLocaleString()} sqft`,
  ].filter(Boolean);
  if (stats.length) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `400 ${13 * S}px sans-serif`;
    ctx.fillText(stats.join("   ·   "), pad, y);
    y += 30 * S;
  }

  // Price
  if (showPrice && price) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${26 * S}px sans-serif`;
    ctx.fillText(price, pad, y);
    y += 32 * S;
  }

  // Business name — bottom right
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = `400 ${11 * S}px sans-serif`;
  const bnW = ctx.measureText(bizName).width;
  ctx.fillText(bizName, W - pad - bnW, H - 30 * S);
}

// ── Template: Open House ─────────────────────────────────────────────────────
// Cinematic full-bleed with dramatic large type
function drawOpenHouse(ctx, W, H, img, opts) {
  const { headline, sub, price, beds, baths, sqft, primary, accent, bizName, showPrice } = opts;
  const S = W / 1080;

  if (img) {
    drawCover(ctx, img, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1e3a5f");
    grad.addColorStop(1, "#0F172A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Vignette — full canvas dark overlay, stronger at edges/bottom
  const scrim = ctx.createLinearGradient(0, H * 0.25, 0, H);
  scrim.addColorStop(0, "rgba(0,0,0,0.15)");
  scrim.addColorStop(0.6, "rgba(0,0,0,0.72)");
  scrim.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 7 * S, H);

  const pad = 60 * S;
  let y = H * 0.44;

  // "OPEN" large
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${90 * S}px Georgia, serif`;
  ctx.fillText("OPEN", pad, y);
  y += 96 * S;

  // "HOUSE" in accent
  ctx.fillStyle = accent;
  ctx.font = `900 ${90 * S}px Georgia, serif`;
  ctx.fillText("HOUSE", pad, y);
  y += 40 * S;

  // Thin white rule
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(pad, y, W - pad * 2, 1 * S);
  y += 22 * S;

  // Date / subtitle
  if (sub) {
    ctx.fillStyle = accent;
    ctx.font = `600 ${16 * S}px sans-serif`;
    ctx.fillText(sub.toUpperCase(), pad, y);
    y += 28 * S;
  }

  // Address
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `400 ${17 * S}px sans-serif`;
  wrapText(ctx, headline || "Property Address", pad, y, W - pad * 2 - 80 * S, 26 * S, 2);
  y += 34 * S;

  // Stats
  const stats = [
    beds  && `${beds} bd`,
    baths && `${baths} ba`,
    sqft  && `${Number(sqft).toLocaleString()} sqft`,
    showPrice && price && price,
  ].filter(Boolean);
  if (stats.length) {
    ctx.fillStyle = "rgba(255,255,255,0.50)";
    ctx.font = `400 ${12 * S}px sans-serif`;
    ctx.fillText(stats.join("  ·  "), pad, y);
  }

  // Business name — top right
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `400 ${12 * S}px sans-serif`;
  const bnW = ctx.measureText(bizName).width;
  ctx.fillText(bizName, W - 30 * S - bnW, 36 * S);
}

// ── Template: Story Slide ────────────────────────────────────────────────────
// Portrait — image top 64%, clean dark editorial panel bottom 36%
function drawStorySlide(ctx, W, H, img, opts) {
  const { headline, sub, price, beds, baths, sqft, primary, accent, bizName, showPrice } = opts;
  const S = W / 1080;

  const splitY = H * 0.62;

  // Image zone
  if (img) {
    ctx.save();
    ctx.rect(0, 0, W, splitY);
    ctx.clip();
    drawCover(ctx, img, 0, 0, W, splitY);
    ctx.restore();
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, splitY);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, "#0F172A");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, splitY);
  }

  // Fade from photo into dark panel
  const fade = ctx.createLinearGradient(0, splitY - H * 0.12, 0, splitY + 1);
  fade.addColorStop(0, "rgba(15,23,42,0)");
  fade.addColorStop(1, "rgba(15,23,42,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, splitY - H * 0.12, W, H * 0.12 + 1);

  // Bottom dark panel
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, splitY, W, H - splitY);

  const pad = 52 * S;
  let y = splitY + 46 * S;

  // "FEATURED LISTING" tag
  ctx.letterSpacing = `${2 * S}px`;
  ctx.fillStyle = accent;
  ctx.font = `700 ${10 * S}px sans-serif`;
  ctx.fillText("FEATURED LISTING", pad, y);
  ctx.letterSpacing = "0px";
  y += 20 * S;

  // Accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(pad, y, 38 * S, 2.5 * S);
  y += 20 * S;

  // Address
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${36 * S}px Georgia, serif`;
  wrapText(ctx, headline || "Property Address", pad, y, W - pad * 2, 46 * S, 2);
  y += 90 * S;

  // Stats in pill badges
  const stats = [
    beds  && { label: `${beds} BD` },
    baths && { label: `${baths} BA` },
    sqft  && { label: `${Number(sqft).toLocaleString()} SQFT` },
  ].filter(Boolean);

  if (stats.length) {
    ctx.font = `600 ${11 * S}px sans-serif`;
    let sx = pad;
    for (const st of stats) {
      const tw = ctx.measureText(st.label).width;
      const ph = 22 * S;
      const pw = tw + 20 * S;
      roundRect(ctx, sx, y - ph * 0.78, pw, ph, 3 * S);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.fillText(st.label, sx + 10 * S, y);
      sx += pw + 10 * S;
    }
    y += 32 * S;
  }

  // Price
  if (showPrice && price) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${28 * S}px sans-serif`;
    ctx.fillText(price, pad, y);
    y += 36 * S;
  } else if (sub) {
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.font = `400 ${14 * S}px sans-serif`;
    ctx.fillText(sub, pad, y);
    y += 28 * S;
  }

  // Bottom bar
  ctx.fillStyle = primary;
  ctx.fillRect(0, H - 52 * S, W, 52 * S);
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = `600 ${13 * S}px sans-serif`;
  ctx.fillText(bizName.toUpperCase(), pad, H - 20 * S);
}

// ── Template: Promo Card ─────────────────────────────────────────────────────
// 1200×628 landscape — left dark panel, right image
function drawPromoCard(ctx, W, H, img, opts) {
  const { headline, sub, price, beds, baths, sqft, primary, accent, bizName, showPrice } = opts;
  const S = W / 1200;

  const splitX = W * 0.42;

  // Right photo zone
  if (img) {
    ctx.save();
    ctx.rect(splitX, 0, W - splitX, H);
    ctx.clip();
    drawCover(ctx, img, splitX, 0, W - splitX, H);
    ctx.restore();
  } else {
    const grad = ctx.createLinearGradient(splitX, 0, W, H);
    grad.addColorStop(0, "#1e3a5f");
    grad.addColorStop(1, "#0F172A");
    ctx.fillStyle = grad;
    ctx.fillRect(splitX, 0, W - splitX, H);
  }

  // Left panel gradient
  const panelGrad = ctx.createLinearGradient(0, 0, splitX * 1.2, 0);
  panelGrad.addColorStop(0, "#0F172A");
  panelGrad.addColorStop(1, "#1a2a3a");
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, splitX + 40 * S, H);

  // Accent top bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, splitX, 4 * S);

  const pad = 44 * S;
  let y = 52 * S;

  // Business name
  ctx.fillStyle = accent;
  ctx.font = `700 ${11 * S}px sans-serif`;
  ctx.letterSpacing = `${2 * S}px`;
  ctx.fillText(bizName.toUpperCase(), pad, y);
  ctx.letterSpacing = "0px";
  y += 24 * S;

  // Thin rule
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(pad, y, splitX - pad * 2, 1 * S);
  y += 28 * S;

  // "NOW AVAILABLE" small tag
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = `400 ${10 * S}px sans-serif`;
  ctx.letterSpacing = `${1.5 * S}px`;
  ctx.fillText("NOW AVAILABLE", pad, y);
  ctx.letterSpacing = "0px";
  y += 22 * S;

  // Address
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${22 * S}px Georgia, serif`;
  wrapText(ctx, headline || "Property Address", pad, y, splitX - pad * 2, 30 * S, 3);
  y += 90 * S;

  // Stats
  const stats = [
    beds  && `${beds} bed`,
    baths && `${baths} bath`,
    sqft  && `${Number(sqft).toLocaleString()} sqft`,
  ].filter(Boolean);
  if (stats.length) {
    ctx.fillStyle = "rgba(255,255,255,0.50)";
    ctx.font = `400 ${12 * S}px sans-serif`;
    ctx.fillText(stats.join("  ·  "), pad, y);
    y += 26 * S;
  }

  // Price
  if (showPrice && price) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${24 * S}px sans-serif`;
    ctx.fillText(price, pad, y);
    y += 32 * S;
  }

  // Sub text
  if (sub) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `400 ${12 * S}px sans-serif`;
    ctx.fillText(sub, pad, y);
  }

  // Photo-to-panel fade
  const fade = ctx.createLinearGradient(splitX - 60 * S, 0, splitX + 40 * S, 0);
  fade.addColorStop(0, "rgba(26,42,58,1)");
  fade.addColorStop(1, "rgba(26,42,58,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(splitX - 60 * S, 0, 100 * S, H);
}

const DRAWERS = {
  just_listed: drawJustListed,
  open_house:  drawOpenHouse,
  story_slide: drawStorySlide,
  promo_card:  drawPromoCard,
};

export default function MarketingStudio({ booking, branding, coverUrl }) {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);

  const [template,   setTemplate]   = useState("just_listed");
  const [headline,   setHeadline]   = useState(booking?.address || "");
  const [sub,        setSub]        = useState("");
  const [showPrice,  setShowPrice]  = useState(true);
  const [rendering,  setRendering]  = useState(false);
  const [imgLoaded,  setImgLoaded]  = useState(false);

  const pw      = booking?.propertyWebsite || {};
  const primary = branding?.primary || "#3486cf";
  const accent  = branding?.accent  || "#c9a96e";
  const bizName = branding?.bizName || "KyoriaOS";

  const price = pw.price || null;
  const beds  = pw.beds  || null;
  const baths = pw.baths || null;
  const sqft  = pw.sqft  || null;

  const tmpl    = TEMPLATES.find((t) => t.id === template);
  const W_full  = tmpl.w;
  const H_full  = tmpl.h;
  const W_prev  = Math.round(W_full * PREVIEW_SCALE);
  const H_prev  = Math.round(H_full * PREVIEW_SCALE);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = W_prev;
    canvas.height = H_prev;
    const ctx = canvas.getContext("2d");
    const S   = PREVIEW_SCALE;

    const img = imgRef.current?.complete && imgRef.current.naturalWidth ? imgRef.current : null;

    DRAWERS[template](ctx, W_prev, H_prev, img, {
      headline, sub, price, beds, baths, sqft, showPrice,
      primary, accent, bizName,
    });
  }, [template, headline, sub, showPrice, primary, accent, bizName, price, beds, baths, sqft, W_prev, H_prev, imgLoaded]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  // Load cover image once
  useEffect(() => {
    setImgLoaded(false);
    if (!coverUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => { imgRef.current = null; setImgLoaded(false); };
    img.src = coverUrl;
  }, [coverUrl]);

  async function downloadFullRes() {
    setRendering(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = W_full;
      canvas.height = H_full;
      const ctx = canvas.getContext("2d");

      const img = imgRef.current || null;
      DRAWERS[template](ctx, W_full, H_full, img, {
        headline, sub, price, beds, baths, sqft, showPrice,
        primary, accent, bizName,
      });

      const link = document.createElement("a");
      link.download = `kyoriaos-${template}-${Date.now()}.png`;
      link.href     = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setRendering(false);
    }
  }

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
              <span className="text-[10px] text-gray-400">{t.w} × {t.h}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Headline / Address</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30"
            placeholder="1234 Ocean View Dr, San Diego CA" />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">
            {template === "open_house" ? "Date / Time" : "Sub-text (optional)"}
          </label>
          <input value={sub} onChange={(e) => setSub(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30"
            placeholder={template === "open_house" ? "Sunday, May 18  ·  1–4 PM" : "Optional caption or tagline"} />
        </div>
        {price && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setShowPrice((v) => !v)}
              className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${showPrice ? "bg-[#3486cf]" : "bg-gray-200"}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showPrice ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-gray-600">Show price ({price})</span>
          </label>
        )}
      </div>

      {/* Preview */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          Preview
          <span className="ml-2 text-gray-300 normal-case font-normal">{W_full} × {H_full} px</span>
        </p>
        <div
          className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center"
          style={{ aspectRatio: `${W_full}/${H_full}` }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: "block" }}
          />
        </div>
      </div>

      {/* Download full-res */}
      <button onClick={downloadFullRes} disabled={rendering}
        className="w-full py-3 text-sm font-semibold rounded-xl text-white bg-[#3486cf] hover:bg-[#2a72b8] transition-colors disabled:opacity-50">
        {rendering ? "Generating…" : `↓ Download PNG  (${W_full}×${H_full})`}
      </button>
    </div>
  );
}
