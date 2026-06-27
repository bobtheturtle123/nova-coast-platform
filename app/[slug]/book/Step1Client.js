"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import {
  getSqftTier, getItemPrice, SQFT_TIERS, getPricingLabel, getMeasurementUnitLabel,
  calculateTenantPrice, depositLabel,
} from "@/lib/catalogUtils";

// ─── Product Lightbox (detail modal) ────────────────────────────────────────────
function ProductLightbox({ item, images, price, services, onClose }) {
  const [idx, setIdx] = useState(0);
  const includeNames = item.includeNames?.length
    ? item.includeNames
    : (item.includes || []).map((s) => services?.find((sv) => sv.id === s)?.name).filter(Boolean);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose} style={{ backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white rounded-[22px] shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {images.length > 0 && (
          <div className="relative">
            <div className="h-64 overflow-hidden rounded-t-[22px] bg-gray-100">
              <img src={images[idx]} alt={item.name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <>
                <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">‹</button>
                <button onClick={() => setIdx((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">›</button>
              </>
            )}
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-2xl font-extrabold text-[#181B20]">{item.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
          {price && <p className="text-2xl font-extrabold text-[#181B20] mb-3">{price}</p>}
          {item.description && <p className="text-[#3C4046] leading-relaxed mb-4">{item.description}</p>}
          {includeNames.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">What&apos;s included</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {includeNames.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3C4046]">
                    <span className="font-bold" style={{ color: "#A8843F" }}>✓</span>{name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TIER_LABELS = Object.fromEntries(SQFT_TIERS.map((t) => [t.name, t.label]));

const ITEM_IMAGES = {
  essentials:           "https://novacoastmedia.com/wp-content/uploads/2025/07/Photo-work-05.jpg",
  prime:                "https://novacoastmedia.com/wp-content/uploads/2025/09/Photo-012.jpg",
  signature:            "https://novacoastmedia.com/wp-content/uploads/2025/09/ucarecjdn-copy.jpg",
  classicDaytime:       "https://novacoastmedia.com/wp-content/uploads/2024/09/Portfolio-59.jpg",
  luxuryDaytime:        "https://novacoastmedia.com/wp-content/uploads/2026/02/Altered-Photo-25-copy.jpg",
  drone:                "https://novacoastmedia.com/wp-content/uploads/2026/01/Standard-Real-Estate-Video-2-copy.jpg",
  realTwilight:         "https://novacoastmedia.com/wp-content/uploads/2026/01/1-web-or-mls-Photo-124.jpg",
  premiumCinematicVideo:"https://novacoastmedia.com/wp-content/uploads/2025/09/Video.jpg",
  luxuryCinematicVideo: "https://novacoastmedia.com/wp-content/uploads/2026/03/1-web-or-mls-Photo-124-copy.jpg",
  socialReel:           "https://novacoastmedia.com/wp-content/uploads/2025/06/Social-Media-Reel-Real-Estate-copy.jpg",
  matterport:           "https://novacoastmedia.com/wp-content/uploads/2025/06/mp_realestate-dollhouse-copy.jpg",
  zillow3d:             "https://novacoastmedia.com/wp-content/uploads/2025/06/fg.jpg",
};

// Booking-page styles ported from the "Booking Page Hi-Fi" design, scoped to .bkg.
// --brand maps to the tenant's primary color so selected states + the CTA stay
// on-brand, while the neutral ink/gold palette gives the premium, calm look.
const BKG_CSS = `
.bkg{ --ink:#181B20; --ink-2:#23262D; --gold:#C9A96E; --gold-dark:#A8843F; --gold-soft:#F7F0E2;
  --muted:#6B7075; --muted-2:#9CA0A6; --line:#E9E7E1; --line-2:#DEDBD2; --sage-dark:#4A6446; --sage-soft:#ECF1EA;
  --clay:#BC6B4A; --clay-soft:#F8EDE7; --r:18px; --brand:var(--color-primary,#181B20);
  --shadow:0 1px 2px rgba(24,27,32,0.04),0 8px 24px -10px rgba(24,27,32,0.10);
  --shadow-lg:0 24px 60px -22px rgba(24,27,32,0.22);
  color:var(--ink); }
.bkg *{box-sizing:border-box;}
.bkg .shell{max-width:1320px;margin:0 auto;padding:34px 36px 120px;display:grid;grid-template-columns:1fr 336px;gap:48px;align-items:start;}
.bkg .eyebrow{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold-dark);background:var(--gold-soft);padding:6px 13px;border-radius:99px;margin-bottom:16px;}
.bkg .head h1{font-size:33px;font-weight:800;line-height:1.08;letter-spacing:-0.03em;max-width:580px;color:var(--ink);}
.bkg .head p{color:var(--muted);font-size:16px;margin-top:12px;max-width:560px;line-height:1.6;}
.bkg .sqftchip{font-size:12px;color:var(--muted);border:1px solid var(--line-2);background:#fff;border-radius:99px;padding:7px 13px;cursor:pointer;white-space:nowrap;}
.bkg .sqftchip:hover{border-color:var(--ink);color:var(--ink);}
.bkg .block{margin-top:52px;}
.bkg .block.first{margin-top:34px;}
.bkg .section-label{display:flex;align-items:center;gap:14px;margin-bottom:22px;}
.bkg .section-label h2{font-size:20px;font-weight:800;letter-spacing:-0.02em;}
.bkg .section-label s{text-decoration:none;font-size:12.5px;color:var(--muted);}
.bkg .section-label .c{flex:1;height:1px;background:var(--line);}
/* packages */
.bkg .pkgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:22px;align-items:stretch;}
.bkg .pkg{position:relative;border:1.5px solid var(--line-2);background:#fff;border-radius:var(--r);padding:24px 22px;display:flex;flex-direction:column;transition:all .16s;box-shadow:var(--shadow);}
.bkg .pkg:hover{border-color:var(--gold);}
.bkg .pkg.on{border-color:var(--brand);border-width:2px;box-shadow:var(--shadow-lg);}
.bkg .pkg.featured{background:#FFFDF8;border-color:var(--gold);}
.bkg .pkg.featured.on{border-color:var(--brand);}
.bkg .pkg .ribbon{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--gold);color:#2A2008;font-size:10.5px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;padding:5px 13px;border-radius:99px;white-space:nowrap;box-shadow:var(--shadow);}
.bkg .pthumb{border-radius:12px;aspect-ratio:16/9;margin-bottom:13px;overflow:hidden;background:#EFEBE4;}
.bkg .pthumb img{width:100%;height:100%;object-fit:cover;display:block;}
.bkg .pkg .pn{font-size:17px;font-weight:800;}
.bkg .pkg .tg{font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:4px;min-height:34px;}
.bkg .pkg .price{display:flex;align-items:baseline;gap:7px;margin:8px 0 6px;}
.bkg .pkg .price b{font-size:24px;font-weight:800;letter-spacing:-0.03em;color:var(--ink);}
.bkg .save{display:inline-flex;font-size:11px;font-weight:700;color:var(--sage-dark);background:var(--sage-soft);padding:3px 9px;border-radius:99px;align-self:flex-start;margin:0 0 12px;}
/* keep blurbs short + tidy (max two lines) */
.bkg .pkg .tg,.bkg .svc .sb,.bkg .uprow .ab{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
/* explicit dark text so nothing inherits a light/white color */
.bkg h1,.bkg h2,.bkg .pn,.bkg .sn,.bkg .anm,.bkg .ap,.bkg .sp,.bkg .summary h3,.bkg .totrow .v,.bkg .mbar .ml b{color:var(--ink);}
.bkg .pkg ul{list-style:none;padding:0;margin:2px 0 14px;display:flex;flex-direction:column;gap:7px;flex:1;}
.bkg .pkg li{font-size:12.6px;display:flex;gap:8px;color:#3C4046;line-height:1.4;}
.bkg .pkg li svg{width:14px;height:14px;flex-shrink:0;margin-top:1px;color:var(--gold-dark);}
.bkg .detlink{background:#fff;border:1.3px solid var(--line-2);border-radius:9px;font-size:12px;font-weight:600;color:var(--gold-dark);display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;margin-bottom:10px;align-self:flex-start;cursor:pointer;transition:all .14s;}
.bkg .detlink:hover{border-color:var(--gold);background:var(--gold-soft);}
.bkg .detlink svg{width:14px;height:14px;}
.bkg .selbtn{height:43px;border-radius:11px;border:1.5px solid var(--line-2);background:#fff;font-size:13.5px;font-weight:700;color:var(--ink);display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;transition:all .14s;}
.bkg .pkg:hover .selbtn{border-color:var(--brand);}
.bkg .pkg.featured .selbtn{border-color:var(--brand);background:var(--brand);color:#fff;}
.bkg .pkg.on .selbtn{background:var(--brand);border-color:var(--brand);color:#fff;}
.bkg .selbtn svg{width:15px;height:15px;}
/* upgrades */
.bkg .uphead{margin-bottom:18px;}
.bkg .uphead h2{font-size:20px;font-weight:800;letter-spacing:-0.02em;}
.bkg .uphead p{font-size:14px;color:var(--muted);margin-top:6px;max-width:560px;line-height:1.55;}
.bkg .uprows{display:flex;flex-direction:column;gap:12px;}
.bkg .uprow{display:flex;align-items:center;gap:14px;padding:15px 18px;border:1.5px solid var(--line-2);background:#fff;border-radius:13px;transition:all .14s;text-align:left;width:100%;cursor:pointer;}
.bkg .uprow:hover{border-color:var(--gold);}
.bkg .uprow.on{border-color:var(--brand);background:#FCFBF8;}
.bkg .uprow .box{width:20px;height:20px;border-radius:6px;border:1.8px solid var(--line-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#fff;}
.bkg .uprow .box svg{width:12px;height:12px;color:#fff;opacity:0;}
.bkg .uprow.on .box{background:var(--brand);border-color:var(--brand);}
.bkg .uprow.on .box svg{opacity:1;}
.bkg .uprow .umini{width:58px;height:44px;border-radius:9px;flex-shrink:0;overflow:hidden;background:#EFEBE4;}
.bkg .uprow .umini img{width:100%;height:100%;object-fit:cover;}
.bkg .uprow .mid{flex:1;min-width:0;}
.bkg .uprow .anm{font-size:13.6px;font-weight:700;}
.bkg .uprow .ab{font-size:11.8px;color:var(--muted);line-height:1.4;margin-top:2px;}
.bkg .detbtn{background:#fff;border:1.3px solid var(--line-2);border-radius:8px;padding:5px 10px;margin-top:7px;font-size:11.5px;font-weight:600;color:var(--gold-dark);display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .14s;align-self:flex-start;}
.bkg .detbtn:hover{border-color:var(--gold);background:var(--gold-soft);}
.bkg .detbtn svg{width:13px;height:13px;}
.bkg .svc .foot .detbtn{margin-top:0;}
.bkg .uprow .ap{font-size:13.5px;font-weight:800;white-space:nowrap;flex-shrink:0;}
.bkg .uprow .ap s{text-decoration:none;font-size:10.5px;font-weight:500;color:var(--muted-2);}
/* à la carte */
.bkg .alacarte{margin-top:14px;border:1px solid var(--line);background:#fff;border-radius:var(--r);overflow:hidden;}
.bkg .ala-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:none;border:none;text-align:left;cursor:pointer;}
.bkg .ala-toggle:hover{background:#F8F7F4;}
.bkg .ala-txt b{font-size:15px;font-weight:700;display:block;}
.bkg .ala-txt s{text-decoration:none;font-size:12.8px;color:var(--muted);display:block;margin-top:3px;}
.bkg .ala-btn{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ink);border:1.5px solid var(--line-2);border-radius:10px;padding:9px 15px;flex-shrink:0;white-space:nowrap;}
.bkg .ala-btn svg{width:14px;height:14px;transition:transform .2s;}
.bkg .alacarte.open .ala-btn svg{transform:rotate(180deg);}
.bkg .ala-body{padding:0 22px 22px;}
.bkg .svcs{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.bkg .svc{border:1.5px solid var(--line-2);background:#fff;border-radius:var(--r);overflow:hidden;transition:all .16s;box-shadow:var(--shadow);display:flex;flex-direction:column;cursor:pointer;}
.bkg .svc:hover{border-color:var(--gold);}
.bkg .svc.on{border-color:var(--brand);border-width:2px;}
.bkg .svc .sthumb{aspect-ratio:16/9;background:#EFEBE4;overflow:hidden;}
.bkg .svc .sthumb img{width:100%;height:100%;object-fit:cover;}
.bkg .svc .meta{padding:14px 16px 15px;display:flex;flex-direction:column;flex:1;}
.bkg .svc .top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
.bkg .svc .sn{font-size:15px;font-weight:800;flex:1;min-width:0;}
.bkg .svc .sp{font-size:15px;font-weight:800;white-space:nowrap;}
.bkg .svc .sb{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.45;flex:1;}
.bkg .svc .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;}
.bkg .addbtn{height:36px;padding:0 15px;border-radius:10px;border:1.5px solid var(--ink);background:#fff;font-size:13px;font-weight:700;color:var(--ink);display:inline-flex;align-items:center;gap:6px;cursor:pointer;}
.bkg .svc.on .addbtn{background:var(--brand);border-color:var(--brand);color:#fff;}
/* retainers */
.bkg .ret{display:flex;align-items:center;gap:13px;padding:13px 15px;border:1.5px solid var(--line-2);background:#fff;border-radius:13px;cursor:pointer;width:100%;text-align:left;}
.bkg .ret.on{border-color:var(--brand);background:#FCFBF8;}
.bkg .ret .box{width:20px;height:20px;border-radius:6px;border:1.8px solid var(--line-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.bkg .ret.on .box{background:var(--brand);border-color:var(--brand);color:#fff;}
/* summary */
.bkg .summary{position:sticky;top:18px;background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden;}
.bkg .summary .sh{padding:17px 20px 14px;border-bottom:1px solid var(--line);}
.bkg .summary .sh h3{font-size:15px;font-weight:800;}
.bkg .summary .sh p{font-size:12px;color:var(--muted);margin-top:2px;}
.bkg .summary .sbody{padding:15px 20px;}
.bkg .sline{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;padding:6px 0;}
.bkg .sline .l{color:#3C4046;}
.bkg .sline .l em{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted-2);display:block;margin-bottom:1px;}
.bkg .sline .v{font-weight:700;white-space:nowrap;}
.bkg .sdiv{height:1px;background:var(--line);margin:9px 0;}
.bkg .empty{font-size:12.5px;color:var(--muted-2);padding:8px 0 12px;line-height:1.55;}
.bkg .totrow{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0 2px;}
.bkg .totrow .l{font-size:14px;font-weight:700;}
.bkg .totrow .v{font-size:22px;font-weight:800;letter-spacing:-0.02em;}
.bkg .deposit{background:#F8F7F4;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-top:13px;}
.bkg .deposit .d1{display:flex;justify-content:space-between;align-items:baseline;}
.bkg .deposit .d1 .l{font-size:13px;font-weight:700;}
.bkg .deposit .d1 .v{font-size:18px;font-weight:800;color:var(--gold-dark);}
.bkg .deposit .d2{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:5px;}
.bkg .cta{display:flex;width:100%;height:50px;border:none;border-radius:13px;background:var(--brand);color:#fff;font-size:15px;font-weight:700;margin-top:15px;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:all .15s;}
.bkg .cta:hover{filter:brightness(0.94);transform:translateY(-1px);}
.bkg .cta:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.bkg .cta svg{width:16px;height:16px;}
.bkg .trust{display:flex;flex-direction:column;gap:7px;margin-top:13px;}
.bkg .trust .t{display:flex;gap:8px;align-items:flex-start;font-size:11.6px;color:var(--muted);}
.bkg .trust .t svg{width:13px;height:13px;color:var(--sage-dark);flex-shrink:0;margin-top:1px;}
/* mobile bar */
.bkg .mbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;align-items:center;gap:14px;background:rgba(255,255,255,0.96);backdrop-filter:blur(14px);border-top:1px solid var(--line);box-shadow:0 -8px 30px -16px rgba(24,27,32,0.2);padding:11px 18px;}
.bkg .mbar .ml{flex:1;min-width:0;}
.bkg .mbar .ml b{font-size:21px;font-weight:800;letter-spacing:-0.02em;}
.bkg .mbar .ml s{text-decoration:none;font-size:11.5px;color:var(--muted);display:block;margin-top:1px;}
.bkg .mbar .ml s em{font-style:normal;font-weight:700;color:var(--gold-dark);}
.bkg .mbar .mcta{height:48px;padding:0 22px;border:none;border-radius:12px;background:var(--brand);color:#fff;font-size:14.5px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:7px;cursor:pointer;}
.bkg .mbar .mcta:disabled{opacity:.4;}
@media(max-width:1020px){
  .bkg .shell{grid-template-columns:1fr;padding-bottom:104px;}
  .bkg .summary{position:static;}
  .bkg .svcs{grid-template-columns:1fr;}
  .bkg .mbar{display:flex;}
}
@media(max-width:560px){ .bkg .shell{padding:18px 18px 104px;} }
`;

const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const ARROW = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const INFO = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>;

export default function TenantBookStep1Client({ slug, tenantId, tenantName, catalog }) {
  const router = useRouter();
  const {
    packageIds, serviceIds, addonIds, retainerIds, squareFootage, travelFee,
    togglePackage, toggleService, toggleAddon, toggleRetainer,
    hasSelections, setTenant, setSquareFootage, setPricing,
  } = useBookingStore();

  const pricingConfig = catalog.pricingConfig || {};
  const pricingMode   = pricingConfig.mode || "sqft";
  const usesGate      = pricingMode !== "flat";
  const gateLabel     = getPricingLabel(pricingConfig) || "Value";
  const unitLabel     = getMeasurementUnitLabel(pricingConfig); // "sq ft" | "m²"
  const isMetric      = pricingConfig.unit === "sqm";
  const customLabel   = (pricingConfig.customGateLabel || "value").toLowerCase();
  const gateQuestion  = pricingMode === "photos" ? "How many photos do you need?"
    : pricingMode === "custom" ? `What's your ${customLabel}?`
    : isMetric ? "What's the size in m²?" : "What's the square footage?";
  const gateSubtext   = pricingMode === "photos" ? "Tell us how many photos you need so we can show you exact pricing."
    : pricingMode === "custom" ? `Enter your ${customLabel} so we can show you exact pricing.`
    : `Enter the interior size of the home (${unitLabel}) so we can show you exact pricing.`;

  const [sqftInput,    setSqftInput]    = useState(squareFootage || "");
  const [confirmed,    setConfirmed]    = useState(!usesGate || !!squareFootage);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [alaOpen,      setAlaOpen]      = useState(!!catalog.bookingConfig?.servicesExpanded);

  function getImages(item) {
    if (item.mediaUrls?.length) return item.mediaUrls.filter((u) => u && !u.match(/\.(mp4|mov|webm)$/i));
    const fallback = ITEM_IMAGES[item.id];
    return fallback ? [fallback] : [];
  }
  // Whole-card click opens the details lightbox for any package / service / add-on.
  function openDetails(item) {
    setLightboxItem({ item, images: getImages(item), price: displayPrice(item) });
  }

  useEffect(() => {
    setTenant(slug, tenantId, tenantName);
    if (!usesGate) { setSquareFootage(""); setConfirmed(true); }
  }, [slug, tenantId, tenantName, setTenant, usesGate, setSquareFootage]);

  const tier = getSqftTier(usesGate ? (squareFootage || sqftInput) : 0, pricingConfig);
  const { packages = [], services = [], addons = [] } = catalog;

  function confirmSqft() { setSquareFootage(sqftInput); setConfirmed(true); }
  const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;
  function priceOf(item) { return usesGate ? getItemPrice(item, tier) : Number(item.price || 0); }
  function displayPrice(item) { const p = priceOf(item); return p ? fmt(p) : ""; }
  // Resolve the tier's label from the studio's own tiers (never "undefined").
  // For metric studios, build the label from the tier max + unit so it doesn't
  // show the imperial default ("Under 800 sqft").
  const tierObj   = (pricingConfig.tiers?.length ? pricingConfig.tiers : SQFT_TIERS).find((t) => t.name === tier);
  const tierLabel = usesGate && tier && pricingMode === "sqft"
    ? (tierObj?.label
        || (isMetric && tierObj ? `to ${(tierObj.max || 0).toLocaleString()} ${unitLabel}` : (TIER_LABELS[tier] || "")))
    : "";
  // Keep card copy tidy — short, single-line-ish blurbs.
  function short(text, n = 96) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
  }
  // Savings vs. à la carte: sum the package's included services, minus its price.
  function savingsFor(pk) {
    const ala = (pk.includes || []).reduce((sum, sid) => {
      const s = services.find((x) => x.id === sid);
      return sum + (s ? priceOf(s) : 0);
    }, 0);
    return ala - priceOf(pk);
  }

  // Recommended upgrades are STRICTLY the add-ons explicitly assigned to a
  // selected package/service (via each add-on's showWith triggers). An add-on
  // with no triggers is "general" — it never masquerades as a package
  // recommendation; it lives in its own optional "More add-ons" list.
  const selectedIds = new Set([...packageIds, ...serviceIds]);
  const recommendedAddons = selectedIds.size
    ? addons.filter((a) => Array.isArray(a.showWith) && a.showWith.some((id) => selectedIds.has(id)))
    : [];
  const activeRetainers = (catalog.retainers || []).filter((r) => r.active !== false);
  // Trust badges are tenant-controlled. If they've configured a list (even empty),
  // use it verbatim; otherwise show a single safe, always-true default.
  const trustLines = Array.isArray(catalog.bookingConfig?.trustBadges)
    ? catalog.bookingConfig.trustBadges.filter((t) => t && t.trim())
    : ["Secure checkout — only a deposit is due today"];

  // Live quote
  const quote = calculateTenantPrice(packageIds, serviceIds, addonIds, travelFee, catalog, usesGate ? (squareFootage || sqftInput) : 0);
  const hasAny = packageIds.length + serviceIds.length + addonIds.length > 0;

  function buildLines() {
    const lines = [];
    packages.filter((p) => packageIds.includes(p.id)).forEach((p) => lines.push({ kind: "package", name: p.name, amount: priceOf(p) }));
    services.filter((s) => serviceIds.includes(s.id)).forEach((s) => lines.push({ kind: "service", name: s.name, amount: priceOf(s) }));
    addons.filter((a) => addonIds.includes(a.id)).forEach((a) => lines.push({ kind: "addon", name: a.name, amount: priceOf(a) }));
    return lines;
  }

  function goContinue() {
    if (!hasSelections()) return;
    setPricing(quote);
    router.push(`/${slug}/book/property`);
  }

  // ── Pricing gate ───────────────────────────────────────────────────────────
  if (usesGate && !confirmed) {
    const cap = pricingConfig.cap || {};
    const overCap = cap.enabled && Number(cap.max) > 0 && Number(sqftInput) > Number(cap.max);
    const canConfirm = (pricingMode === "photos" ? !!sqftInput : !!tier) && !overCap;
    return (
      <>
        <StepProgress current={1} />
        <div className="step-container">
          <div className="max-w-md mx-auto text-center">
            <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8843F", background: "#F7F0E2", padding: "5px 12px", borderRadius: 99, marginBottom: 16 }}>Step 1 · Package</span>
            <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: "#181B20", lineHeight: 1.1 }} className="mb-3">{gateQuestion}</h1>
            <p className="font-body text-gray-500 mb-10 leading-relaxed">{gateSubtext}</p>
            <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
              <input type="number" inputMode="numeric" min="0" autoFocus
                placeholder={pricingMode === "photos" ? "30" : "2400"}
                value={sqftInput} onChange={(e) => setSqftInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canConfirm && confirmSqft()}
                className="w-full bg-transparent border-0 border-b border-gray-200 focus:ring-0 outline-none font-display text-5xl text-center pb-3 mb-2 transition-colors"
                style={{ color: "var(--color-primary)", borderBottomColor: "var(--color-primary)" }} />
              <p className="text-xs text-gray-400 mb-7 tracking-widest uppercase">
                {tier && pricingMode !== "photos" && pricingMode !== "custom"
                  ? <span className="font-semibold" style={{ color: "#A8843F" }}>{tierLabel || TIER_LABELS[tier]}</span>
                  : sqftInput ? `${Number(sqftInput).toLocaleString()} ${pricingMode === "photos" ? "photos" : pricingMode === "custom" ? customLabel : "sq ft"}` : gateLabel}
              </p>
              {overCap && (
                <p className="text-xs text-red-500 mb-4 leading-relaxed">
                  We don&apos;t take online bookings above {Number(cap.max).toLocaleString()} {pricingMode === "photos" ? "photos" : pricingMode === "custom" ? customLabel : "sq ft"}. Please contact us directly for a custom quote.
                </p>
              )}
              <button onClick={confirmSqft} disabled={!canConfirm} className="btn-primary w-full py-3.5">Show Pricing →</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const lines = buildLines();

  // ── Summary (shared desktop + mobile data) ──────────────────────────────────
  const SummaryInner = () => (
    <div className="summary">
      <div className="sh"><h3>Your shoot</h3><p>{depositLabel(pricingConfig?.deposit || catalog.bookingConfig?.deposit) === "Pay in full" ? "Pay in full at checkout." : "Only a deposit is due today."}</p></div>
      <div className="sbody">
        {!hasAny ? (
          <div className="empty">Choose a package to start your booking — or open “individual services” below.</div>
        ) : (
          <div>
            {lines.map((l, i) => (
              <div className="sline" key={i}>
                <span className="l">{l.kind !== "package" && <em>{l.kind === "addon" ? "Upgrade" : "Service"}</em>}{l.name}</span>
                <span className="v">{l.kind === "package" ? "" : "+"}{fmt(l.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="sdiv" />
        <div className="totrow"><span className="l">Total</span><span className="v">{fmt(quote.subtotal)}</span></div>
        <div className="deposit">
          <div className="d1"><span className="l">Due today (deposit)</span><span className="v">{fmt(quote.deposit)}</span></div>
          <div className="d2"><span>Balance due at delivery</span><span>{fmt(quote.balance)}</span></div>
        </div>
        <button className="cta" disabled={!hasSelections()} onClick={goContinue}>Continue to scheduling {ARROW}</button>
        {trustLines.length > 0 && (
          <div className="trust">
            {trustLines.map((t, i) => <span className="t" key={i}>{CHECK}{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <div className="bkg">
      <style dangerouslySetInnerHTML={{ __html: BKG_CSS }} />
      <StepProgress current={1} />
      <div className="shell">
        <div className="main">
          <div className="head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">Step 1 · {packages.length > 0 ? "Choose your package" : "Choose your services"}</span>
              <h1>{packages.length > 0 ? "Choose your listing media package" : "Choose the services you need"}</h1>
              <p>{packages.length > 0 ? "Start with a package, then add any upgrades needed for this property." : "Pick the services for this shoot, then add any upgrades."}</p>
            </div>
            {usesGate && (
              <button className="sqftchip" onClick={() => setConfirmed(false)}>
                {Number(squareFootage || sqftInput).toLocaleString()} {pricingMode === "photos" ? "photos" : pricingMode === "custom" ? customLabel : unitLabel}{tierLabel ? ` · ${tierLabel}` : ""} ✎
              </button>
            )}
          </div>

          {/* PACKAGES */}
          {packages.length > 0 && (
            <section className="block first">
              <div className="section-label"><h2>Packages</h2><s>Recommended starting points for most listings</s><span className="c" /></div>
              <div className="pkgs">
                {packages.map((pk) => {
                  const on = packageIds.includes(pk.id);
                  const images = getImages(pk);
                  const names = pk.includeNames?.length ? pk.includeNames : (pk.includes || []).map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean);
                  return (
                    <div key={pk.id} className={`pkg${on ? " on" : ""}${pk.featured ? " featured" : ""}`}>
                      {pk.featured && <span className="ribbon">Recommended for most listings</span>}
                      {images[0] && <div className="pthumb"><img src={images[0]} alt={pk.name} /></div>}
                      <div className="pn">{pk.name}</div>
                      {(pk.tagline || pk.description) && <div className="tg">{pk.tagline || short(pk.description, 80)}</div>}
                      <div className="price"><b>{displayPrice(pk)}</b></div>
                      {(() => { const sv = savingsFor(pk); return sv > 0 ? <span className="save">Save {fmt(sv)} vs. à la carte</span> : null; })()}
                      {names.length > 0 && (
                        <ul>{names.slice(0, 5).map((n, i) => <li key={i}>{CHECK}<span>{n}</span></li>)}</ul>
                      )}
                      <button className="detlink" onClick={() => openDetails(pk)}>{INFO}See what&apos;s included</button>
                      <button className="selbtn" onClick={() => togglePackage(pk.id)}>{on ? <>{CHECK}Selected</> : "Select package"}</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* RECOMMENDED UPGRADES — strictly the add-ons assigned to the selection */}
          {recommendedAddons.length > 0 && (
            <section className="block">
              <div className="uphead">
                <h2>Recommended upgrades</h2>
                <p>Add-ons chosen to pair with the {packageIds.length ? "package" : "services"} you selected.</p>
              </div>
              <div className="uprows">
                {recommendedAddons.map((a) => {
                  const on = addonIds.includes(a.id);
                  const images = getImages(a);
                  return (
                    <div key={a.id} className={`uprow${on ? " on" : ""}`} onClick={() => toggleAddon(a.id)}>
                      <span className="box">{CHECK}</span>
                      {images[0] && <div className="umini"><img src={images[0]} alt="" /></div>}
                      <span className="mid">
                        <span className="anm">{a.name}</span>
                        {a.description && <span className="ab">{short(a.description, 90)}</span>}
                        {(a.description || images.length > 0) && (
                          <button className="detbtn" onClick={(e) => { e.stopPropagation(); openDetails(a); }}>{INFO}Details</button>
                        )}
                      </span>
                      <span className="ap">+{displayPrice(a)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* À LA CARTE (collapsed) */}
          {services.length > 0 && (
            <section className="block">
              <div className={`alacarte${alaOpen ? " open" : ""}`}>
                <button className="ala-toggle" onClick={() => setAlaOpen((v) => !v)}>
                  <span className="ala-txt"><b>Need individual services only?</b><s>Use this if you&apos;re not booking a full listing package.</s></span>
                  <span className="ala-btn">{alaOpen ? "Hide" : "View"} individual services <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></span>
                </button>
                {alaOpen && (
                  <div className="ala-body">
                    <div className="svcs">
                      {services.map((s) => {
                        const on = serviceIds.includes(s.id);
                        const images = getImages(s);
                        return (
                          <div key={s.id} className={`svc${on ? " on" : ""}`} onClick={() => toggleService(s.id)}>
                            {images[0] && <div className="sthumb"><img src={images[0]} alt={s.name} /></div>}
                            <div className="meta">
                              <div className="top"><span className="sn">{s.name}</span><span className="sp">{displayPrice(s)}</span></div>
                              {s.description && <div className="sb">{s.description}</div>}
                              <div className="foot">
                                <button className="detbtn" onClick={(e) => { e.stopPropagation(); openDetails(s); }}>{INFO}Details</button>
                                <button className="addbtn">{on ? <>{CHECK}Added</> : "+ Add"}</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* RETAINERS (optional) */}
          {activeRetainers.length > 0 && (
            <section className="block">
              <div className="section-label"><h2>Ongoing plans</h2><s>Optional · invoiced separately</s><span className="c" /></div>
              <div className="uprows">
                {activeRetainers.map((r) => {
                  const on = (retainerIds || []).includes(r.id);
                  const per = r.interval === "year" ? "yr" : r.interval === "quarter" ? "qtr" : "mo";
                  return (
                    <div key={r.id} className={`ret${on ? " on" : ""}`} onClick={() => toggleRetainer(r.id)}>
                      <span className="box">{CHECK}</span>
                      <span className="mid">
                        <span className="anm">{r.name}</span>
                        {r.description && <span className="ab" style={{ display: "block", fontSize: 11.8, color: "var(--muted)", marginTop: 2 }}>{r.description}</span>}
                      </span>
                      {Number(r.price) > 0 && <span className="ap">${Number(r.price).toLocaleString()}/{per}</span>}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 9 }}>Invoiced separately — not added to this booking&apos;s total. We&apos;ll send the setup after your booking.</p>
            </section>
          )}
        </div>

        {/* SUMMARY (desktop) */}
        <aside className="desktop-summary"><SummaryInner /></aside>
      </div>

      {/* MOBILE STICKY BAR */}
      <div className="mbar">
        <div className="ml"><b>{fmt(quote.subtotal)}</b><s>total · <em>{fmt(quote.deposit)}</em> due today</s></div>
        <button className="mcta" disabled={!hasSelections()} onClick={goContinue}>Continue {ARROW}</button>
      </div>

      {lightboxItem && (
        <ProductLightbox item={lightboxItem.item} images={lightboxItem.images} price={lightboxItem.price} services={services} onClose={() => setLightboxItem(null)} />
      )}
    </div>
  );
}
