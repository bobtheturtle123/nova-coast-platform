"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";

async function uploadProductMedia(file) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/dashboard/products/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: file.name, fileType: file.type }),
  });
  const { uploadUrl, publicUrl, error } = await res.json();
  if (error) throw new Error(error);
  await fetch(uploadUrl, { method: "PUT", body: file });
  return publicUrl;
}

const SQFT_TIERS = ["Tiny", "Small", "Medium", "Large", "XL", "XXL"];
const TIER_LABELS = {
  Tiny:   "0–800 sqft",
  Small:  "801–2,500",
  Medium: "2,501–4,000",
  Large:  "4,001–6,000",
  XL:     "6,001–8,500",
  XXL:    "8,500+",
};

const TYPE_META = {
  packages: { label: "Packages",   singular: "Package",     color: "bg-blue-50 text-blue-700 border-blue-200" },
  services: { label: "Services",   singular: "Service",     color: "bg-purple-50 text-purple-700 border-purple-200" },
  addons:   { label: "Add-ons",    singular: "Add-on",      color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// ─── Product edit form ────────────────────────────────────────────────────────
function ProductForm({ item, type: initialType, allServices, allPackages, teamMembers, pricingConfig, onSave, onDelete, onClose }) {
  const [type, setType] = useState(initialType);
  const [form, setForm] = useState(() => ({
    name:         item?.name         || "",
    description:  item?.description  || "",
    mediaUrls:    item?.mediaUrls    || (item?.thumbnailUrl ? [item.thumbnailUrl] : []),
    price:        item?.price        || 0,
    tagline:      item?.tagline      || "",
    deliverables: item?.deliverables || "",
    active:       item?.active !== false,
    featured:     item?.featured     || false,
    tiered:       !!(item?.priceTiers),
    priceTiers:   item?.priceTiers || {},
    includes:     item?.includes     || [],
    showWith:     item?.showWith     || [],
    isTwilight:   item?.isTwilight   || false,
    assignedPhotographers: item?.assignedPhotographers || [],
    payRate:      item?.payRate      ?? "",
    payRateTiers: item?.payRateTiers || {},
    duration:     item?.duration     ?? "",
  }));
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  function field(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  function tierField(tier) {
    return (e) => setForm((f) => ({
      ...f,
      priceTiers: { ...f.priceTiers, [tier]: Number(e.target.value) || 0 },
    }));
  }

  function toggleService(svcId) {
    setForm((f) => ({
      ...f,
      includes: f.includes.includes(svcId)
        ? f.includes.filter((id) => id !== svcId)
        : [...f.includes, svcId],
    }));
  }

  function toggleShowWith(id) {
    setForm((f) => ({
      ...f,
      showWith: f.showWith.includes(id)
        ? f.showWith.filter((x) => x !== id)
        : [...f.showWith, id],
    }));
  }

  function togglePhotographer(uid) {
    setForm((f) => ({
      ...f,
      assignedPhotographers: f.assignedPhotographers.includes(uid)
        ? f.assignedPhotographers.filter((id) => id !== uid)
        : [...f.assignedPhotographers, uid],
    }));
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadProductMedia(f)));
      setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, ...urls] }));
    } catch (err) {
      setUploadError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(idx) {
    setForm((f) => ({ ...f, mediaUrls: f.mediaUrls.filter((_, i) => i !== idx) }));
  }

  function moveMedia(from, to) {
    setForm((f) => {
      const arr = [...f.mediaUrls];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { ...f, mediaUrls: arr };
    });
  }

  function setCover(idx) {
    if (idx === 0) return;
    moveMedia(idx, 0);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name:        form.name,
      description: form.description,
      mediaUrls:   form.mediaUrls,
      thumbnailUrl: form.mediaUrls[0] || "",
      price:       Number(form.price),
      active:      form.active,
      assignedPhotographers: form.assignedPhotographers,
      ...(form.tiered ? { priceTiers: form.priceTiers } : { priceTiers: null }),
      ...(type === "packages" ? { tagline: form.tagline, deliverables: form.deliverables, featured: form.featured, includes: form.includes } : {}),
      ...(type === "addons" ? { showWith: form.showWith } : {}),
      ...((type === "services" || type === "packages") ? { isTwilight: form.isTwilight } : {}),
      ...(type === "services" ? { duration: form.duration !== "" ? Number(form.duration) : null } : {}),
      payRate:      form.payRate !== "" ? Number(form.payRate) : null,
      payRateTiers: form.tiered && Object.keys(form.payRateTiers).length > 0 ? form.payRateTiers : null,
    };
    await onSave(payload, type);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-[#0F172A] text-base">
            {item ? `Edit ${TYPE_META[type].singular}` : "New Item"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type selector — only when creating new */}
          {!item && (
            <div>
              <label className="label-field">Item Type</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_META).map(([t, meta]) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      type === t
                        ? "border-[#3486cf] bg-[#3486cf] text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}>
                    {meta.singular}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-20 h-20 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
              {form.mediaUrls[0]
                ? <img src={form.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🏠</div>
              }
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#0F172A] truncate">{form.name || "Product Name"}</p>
              {form.tagline && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{form.tagline}</p>}
              {!form.tagline && form.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{form.description}</p>
              )}
              <p className="text-sm font-semibold text-[#0F172A] mt-1">
                {form.tiered
                  ? (() => { const tv = Object.values(form.priceTiers).filter(v => v > 0); return tv.length > 0 ? `From $${Math.min(...tv).toLocaleString()}` : "Set tier prices below"; })()
                  : `$${Number(form.price).toLocaleString()}`}
              </p>
            </div>
          </div>

          {/* Core fields */}
          <div>
            <label className="label-field">Title</label>
            <input type="text" value={form.name} onChange={field("name")} className="input-field w-full" placeholder="Product name" />
          </div>

          <div>
            <label className="label-field">Description</label>
            <textarea value={form.description} onChange={field("description")} rows={3}
              className="input-field w-full resize-none" placeholder="Describe what this includes…" />
          </div>

          {/* Media upload */}
          <div>
            <label className="label-field">Photos / Videos</label>
            <input ref={fileInputRef} type="file" multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="hidden" onChange={handleMediaUpload} />
            {form.mediaUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {form.mediaUrls.map((url, idx) => (
                  <div key={url + idx} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 group"
                    style={{ borderColor: idx === 0 ? "#3486cf" : "#e5e7eb" }}>
                    {url.match(/\.(mp4|mov|webm)$/i)
                      ? <video src={url} className="w-full h-full object-cover" />
                      : <img src={url} alt="" className="w-full h-full object-cover" />
                    }
                    {idx === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-[#3486cf]/70 text-white text-[9px] text-center py-0.5 font-semibold tracking-wide">
                        COVER
                      </div>
                    )}
                    {/* Controls overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      {/* Reorder arrows */}
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveMedia(idx, idx - 1)} disabled={idx === 0}
                          className="w-5 h-5 bg-white/20 hover:bg-white/40 text-white rounded text-xs disabled:opacity-30 flex items-center justify-center">
                          ←
                        </button>
                        <button type="button" onClick={() => moveMedia(idx, idx + 1)} disabled={idx === form.mediaUrls.length - 1}
                          className="w-5 h-5 bg-white/20 hover:bg-white/40 text-white rounded text-xs disabled:opacity-30 flex items-center justify-center">
                          →
                        </button>
                      </div>
                      {idx !== 0 && (
                        <button type="button" onClick={() => setCover(idx)}
                          className="text-[9px] text-white/90 bg-[#3486cf]/60 hover:bg-[#3486cf] px-1.5 py-0.5 rounded font-semibold tracking-wide">
                          Set Cover
                        </button>
                      )}
                      <button type="button" onClick={() => removeMedia(idx)}
                        className="text-[9px] text-white/80 hover:text-red-300">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
              {uploading
                ? <><div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Uploading…</>
                : <><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Upload Photos or Video</>
              }
            </button>
            <p className="text-xs text-gray-400 mt-1">First image is the cover. Images and videos only.</p>
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
          </div>

          {/* Package-specific: tagline, deliverables, featured */}
          {type === "packages" && (
            <>
              <div>
                <label className="label-field">Tagline</label>
                <input type="text" value={form.tagline} onChange={field("tagline")}
                  className="input-field w-full" placeholder="One-line selling point" />
              </div>
              <div>
                <label className="label-field">Deliverables</label>
                <input type="text" value={form.deliverables} onChange={field("deliverables")}
                  className="input-field w-full" placeholder="Photos within 24 hrs · Video within 72 hrs" />
              </div>
              <div>
                <label className="label-field">Included Services</label>
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {allServices.map((svc) => (
                    <label key={svc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.includes.includes(svc.id)}
                        onChange={() => toggleService(svc.id)} className="rounded" />
                      <span className="text-sm text-[#0F172A]">{svc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="featured" checked={form.featured} onChange={field("featured")} className="rounded" />
                <label htmlFor="featured" className="text-sm font-medium text-[#0F172A] cursor-pointer">
                  Mark as featured / Most Popular
                </label>
              </div>
            </>
          )}

          {/* Addon dependencies — shown only for add-ons type */}
          {type === "addons" && (allServices.length > 0 || allPackages?.length > 0) && (
            <div>
              <label className="label-field">Show only when these are selected</label>
              <p className="text-xs text-gray-400 mb-2">Leave blank to always show this add-on.</p>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                {allPackages?.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Packages</p>
                    <div className="space-y-1">
                      {allPackages.map((pkg) => (
                        <label key={pkg.id} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                          <input type="checkbox" checked={form.showWith.includes(pkg.id)}
                            onChange={() => toggleShowWith(pkg.id)} className="rounded" />
                          <span className="text-sm text-[#0F172A]">{pkg.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {allServices.length > 0 && (
                  <div className="px-4 py-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Services</p>
                    <div className="space-y-1">
                      {allServices.map((svc) => (
                        <label key={svc.id} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                          <input type="checkbox" checked={form.showWith.includes(svc.id)}
                            onChange={() => toggleShowWith(svc.id)} className="rounded" />
                          <span className="text-sm text-[#0F172A]">{svc.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label-field mb-0">Pricing</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">Tier pricing</span>
                <div
                  onClick={() => setForm((f) => ({ ...f, tiered: !f.tiered }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.tiered ? "bg-[#3486cf]" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.tiered ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </label>
            </div>

            {!form.tiered ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input type="number" value={form.price} onChange={field("price")} min="0" step="1"
                  className="input-field w-40" />
              </div>
            ) : (
              (() => {
                const tiers = pricingConfig?.tiers?.length ? pricingConfig.tiers : [];
                if (tiers.length === 0) {
                  return <p className="text-xs text-amber-600">Configure pricing tiers in Settings → Pricing Tiers first.</p>;
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tiers.map((tier) => (
                      <div key={tier.name}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {tier.label || tier.name}
                          <span className="text-gray-400 ml-1">
                            ({tier.max === 999999 ? "unlimited+" : `to ${(tier.max || 0).toLocaleString()}`})
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-sm">$</span>
                          <input type="number" value={form.priceTiers[tier.name] || ""}
                            onChange={(e) => setForm((f) => ({ ...f, priceTiers: { ...f.priceTiers, [tier.name]: Number(e.target.value) || 0 } }))}
                            min="0" step="1" className="input-field py-1.5 text-sm w-full" placeholder="0" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Photographer pay rate */}
          <div>
            <label className="label-field">Photographer Pay Rate</label>
            <p className="text-xs text-gray-500 mb-2">
              Flat pay per booking for this {TYPE_META[type].singular.toLowerCase()}. Leave blank to use the global hourly rate.
            </p>
            {!form.tiered ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input type="number" value={form.payRate} min="0" step="1" placeholder="e.g. 80"
                  onChange={(e) => setForm((f) => ({ ...f, payRate: e.target.value }))}
                  className="input-field w-40" />
                <span className="text-xs text-gray-400">per booking</span>
              </div>
            ) : (
              (() => {
                const tiers = pricingConfig?.tiers?.length ? pricingConfig.tiers : [];
                if (tiers.length === 0) return null;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tiers.map((tier) => (
                      <div key={tier.name}>
                        <label className="block text-xs text-gray-500 mb-1">{tier.label || tier.name}</label>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-sm">$</span>
                          <input type="number" value={form.payRateTiers[tier.name] || ""}
                            onChange={(e) => setForm((f) => ({ ...f, payRateTiers: { ...f.payRateTiers, [tier.name]: Number(e.target.value) || 0 } }))}
                            min="0" step="1" className="input-field py-1.5 text-sm w-full" placeholder="0" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Photographer assignment */}
          {teamMembers?.length > 0 && (
            <div>
              <label className="label-field">Assigned Photographers</label>
              <p className="text-xs text-gray-400 mb-2">Only these photographers will be assigned to this service. Leave blank for all.</p>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((m) => (
                  <button key={m.id} type="button" onClick={() => togglePhotographer(m.id)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      form.assignedPhotographers.includes(m.id)
                        ? "bg-[#3486cf] text-white border-[#3486cf]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      style={{ background: m.color || "#6B7280" }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration — for services only */}
          {type === "services" && (
            <div>
              <label className="label-field">Duration (minutes)</label>
              <p className="text-xs text-gray-400 mb-2">Estimated time for this service. Used to calculate appointment end times and avoid double-booking.</p>
              <div className="flex items-center gap-2">
                <input type="number" value={form.duration} min="0" max="480" step="15"
                  onChange={field("duration")}
                  className="input-field w-28" placeholder="e.g. 90" />
                <span className="text-xs text-gray-400">min</span>
                {form.duration && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    ≈ {Math.floor(Number(form.duration) / 60) > 0 ? `${Math.floor(Number(form.duration) / 60)}h ` : ""}{Number(form.duration) % 60 > 0 ? `${Number(form.duration) % 60}m` : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Twilight flag — for services/packages */}
          {(type === "services" || type === "packages") && (
            <div className="flex items-center gap-3 pt-1">
              <input type="checkbox" id="isTwilight" checked={form.isTwilight || false}
                onChange={(e) => setForm((f) => ({ ...f, isTwilight: e.target.checked }))}
                className="rounded" />
              <label htmlFor="isTwilight" className="text-sm text-[#0F172A] cursor-pointer">
                Twilight service — triggers sunset-timed second appointment on booking
              </label>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3 pt-1">
            <input type="checkbox" id="active" checked={form.active} onChange={field("active")} className="rounded" />
            <label htmlFor="active" className="text-sm text-[#0F172A] cursor-pointer">
              Active — show on booking page
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between sticky bottom-0 bg-white">
          {item ? (
            <button onClick={handleDelete} disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete product"}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="btn-primary px-6 py-2 text-sm">
              {saving ? "Saving…" : "Save →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product row ──────────────────────────────────────────────────────────────
function ProductRow({ item, type, extraInfo, onEdit, onToggleActive, onDuplicate }) {
  const tierVals = item.priceTiers ? Object.values(item.priceTiers).filter(v => v > 0) : [];
  const fromPrice = item.priceTiers
    ? tierVals.length > 0 ? `From $${Math.min(...tierVals).toLocaleString()}` : "Tier pricing"
    : `$${(item.price || 0).toLocaleString()}`;

  const [hovered, setHovered] = useState(false);
  return (
    <div className="flex items-center gap-4 px-4 py-3 transition-colors"
      style={{ borderBottom: "1px solid var(--border-subtle)", background: hovered ? "rgb(15 23 42 / 0.022)" : "transparent" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Thumb */}
      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-lg opacity-20">🏠</div>
        }
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#0F172A] truncate">{item.name}</p>
          {type === "packages" && item.featured && (
            <span className="text-xs px-1.5 py-0.5 bg-gold/20 text-gold-dark rounded-xl font-medium flex-shrink-0">
              Featured
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
        )}
      </div>

      {/* Extra info column */}
      <div className="w-32 flex-shrink-0 text-right">
        {extraInfo && (
          <span className="text-xs text-gray-400">{extraInfo}</span>
        )}
      </div>

      {/* Price */}
      <p className="text-sm font-semibold text-[#3486cf] flex-shrink-0 w-28 text-right">{fromPrice}</p>

      {/* Active toggle */}
      <div
        onClick={() => onToggleActive(item)}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${item.active !== false ? "bg-[#3486cf]" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.active !== false ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={() => onDuplicate(item)}
          title="Duplicate"
          className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1.5 rounded-xl hover:bg-gray-50">
          Copy
        </button>
        <button onClick={() => onEdit(item)}
          className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded-xl hover:bg-[#3486cf]/5">
          Edit
        </button>
      </div>
    </div>
  );
}

// ─── Import Pricing Button ────────────────────────────────────────────────────
function ImportPricingButton({ onImport, activeType, pricingConfig }) {
  const [open,       setOpen]       = useState(false);
  const [url,        setUrl]        = useState("");
  const [text,       setText]       = useState("");
  const [csvFile,    setCsvFile]    = useState(null);
  const [useTiers,   setUseTiers]   = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [msg,        setMsg]        = useState("");
  const [mode,       setMode]       = useState("csv"); // "csv" | "text" | "url"
  const csvInputRef = useRef(null);

  function getTiers() {
    if (pricingConfig?.tiers?.length) return pricingConfig.tiers;
    return [
      { name: "Tiny",   label: "Under 800 sqft" },
      { name: "Small",  label: "801–2,500 sqft" },
      { name: "Medium", label: "2,501–4,000 sqft" },
      { name: "Large",  label: "4,001–6,000 sqft" },
      { name: "XL",     label: "6,001–8,500 sqft" },
      { name: "XXL",    label: "8,500+ sqft" },
    ];
  }

  function csvEscape(val) {
    const s = String(val ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadTemplate() {
    const tiers = getTiers();

    // Build tier column headers: Price_Tiny_Under_800 style using label if available
    const tierCols = tiers.map((t) => {
      const safeName  = t.name.replace(/\s+/g, "_");
      const safeLabel = (t.label || "").replace(/[,\s–\-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/, "");
      return safeLabel ? `Price_${safeName}_${safeLabel}` : `Price_${safeName}`;
    });

    const baseHeaders    = ["Category", "Service Name", "Pricing Model", "Fixed Price / Unit"];
    const featureHeaders = ["Badge", "Tier Tag", "Marketing Summary", "Feature List", "Image URL"];
    const headers        = [...baseHeaders, ...tierCols, ...featureHeaders];

    function row(category, name, model, fixedPrice, tierPrices, badge, tag, marketing, features, img) {
      const tierVals = tiers.map((t, i) => tierPrices[i] || "");
      return [category, name, model, fixedPrice, ...tierVals, badge, tag, marketing, features, img].map(csvEscape).join(",");
    }

    const rows = [
      row("Package",   "Standard Shoot",          "TIER_BASED", "", [199,249,299,399,499,599], "",             "Photos · Drone",       "Professional coverage ready to publish within 24 hours.|Photos delivered within 24 hours", "25 edited photos|Drone footage|Professional editing", ""),
      row("Package",   "Premium Package",          "TIER_BASED", "", [399,499,599,699,799,999], "Most Popular", "Photos · Drone · Twilight", "Luxury photography with real twilight.|Photos 24hrs · Twilight scheduled at dusk",  "Luxury photography|Drone|Real twilight|Editing",       ""),
      row("A La Carte","Classic Photography",      "TIER_BASED", "", [250,275,325,375,475,525], "",             "",                     "Full interior and exterior coverage for MLS.|Delivered within 24 hours",                "Full coverage|Blue sky replacement|Professional editing", ""),
      row("A La Carte","Drone Photos",             "TIER_BASED", "", [299,299,299,299,299,299], "",             "",                     "Aerial exterior coverage from multiple angles.",                                        "~15 images from varied altitudes|24 hour turnaround",  ""),
      row("A La Carte","Cinematic Video",          "TIER_BASED", "", [375,475,525,599,699,850], "",             "",                     "60-second horizontal video with drone footage.",                                        "60 seconds|Drone included|Delivered within 72 hours",  ""),
      row("Add-On",    "Property Outlines",        "FIXED",      "$39 per image", [], "", "", "Boundary lines overlaid on drone media.", "Per image pricing",        ""),
      row("Add-On",    "Digital Twilight Image",   "FIXED",      "$49 per image", [], "", "", "Warm curb appeal without rescheduling.",  "48 hour delivery",         ""),
      row("Add-On",    "Single Property Website",  "FIXED",      "$79.99",        [], "", "", "All media and property info in one link.", "",                        ""),
      row("Add-On",    "Rush Turnaround",          "FIXED",      "$399",          [], "", "", "Photos by 8:30pm for shoots starting by 1:30pm.", "",                ""),
    ];

    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "products_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    let content = "";
    if (mode === "csv") {
      if (!csvFile) { setMsg("Please select a CSV file."); return; }
      content = await csvFile.text();
    } else {
      content = mode === "url" ? url.trim() : text.trim();
    }
    if (!content) return;

    setImporting(true); setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/products/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ mode, content, targetType: activeType }),
      });
      const data = await res.json();
      if (res.ok && data.imported > 0) {
        setMsg(`✓ Imported ${data.imported} item${data.imported !== 1 ? "s" : ""}. They're saved as drafts — toggle Active when ready.`);
        if (onImport) onImport(data.items || {});
        setTimeout(() => { setOpen(false); setMsg(""); setUrl(""); setText(""); setCsvFile(null); }, 3500);
      } else {
        setMsg(data.error || "No items found. Check your file and try again.");
      }
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function close() { setOpen(false); setMsg(""); setUrl(""); setText(""); setCsvFile(null); }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="btn-outline text-sm px-4 py-2 flex items-center gap-1.5">
        ↓ Import
      </button>
    );
  }

  const canImport = mode === "csv" ? !!csvFile : mode === "url" ? !!url.trim() : !!text.trim();

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={close} />
      <div className="modal-card relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-[#0F172A] text-base">Import Products</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
        </div>
        <div className="p-6 space-y-4">

          {/* Mode tabs */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden text-xs">
            {[["csv", "CSV File"], ["text", "Paste Text"], ["url", "From URL"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-2 flex-1 font-medium transition-colors ${mode === m ? "bg-[#3486cf] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* CSV mode */}
          {mode === "csv" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-800">Download the template, fill it in, then upload</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  Supports: <code className="bg-blue-100 px-1 rounded">Package</code>, <code className="bg-blue-100 px-1 rounded">A La Carte</code>, <code className="bg-blue-100 px-1 rounded">Add-On</code> as Category values.
                  Tier price columns are auto-detected — just include <code className="bg-blue-100 px-1 rounded">Price_*</code> columns.
                  {pricingConfig?.tiers?.length
                    ? ` Your template uses your configured tiers: ${getTiers().map(t => t.name).join(", ")}.`
                    : " Go to Settings → Pricing Tiers to configure your tier names."}
                </p>
                <button onClick={downloadTemplate}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2">
                  ↓ Download CSV template
                </button>
              </div>

              <div>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
                <button onClick={() => csvInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-lg py-6 text-center transition-colors ${
                    csvFile ? "border-emerald-300 bg-emerald-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                  }`}>
                  {csvFile ? (
                    <span className="text-sm font-medium text-emerald-700">{csvFile.name}</span>
                  ) : (
                    <span className="text-sm text-gray-400">Click to select your CSV file</span>
                  )}
                </button>
                {csvFile && (
                  <button onClick={() => setCsvFile(null)} className="text-xs text-gray-400 hover:text-red-500 mt-1">
                    Remove file
                  </button>
                )}
              </div>
            </div>
          )}

          {/* URL mode */}
          {mode === "url" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Paste your pricing page URL. AI will extract services and packages.</p>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                className="input-field w-full" placeholder="https://yourwebsite.com/pricing" />
            </div>
          )}

          {/* Text mode */}
          {mode === "text" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Paste any pricing text — from your website, a PDF, or anywhere. AI will parse it.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                className="input-field w-full text-sm font-mono"
                placeholder={"Real Estate Photography — $299\n• 25 edited photos\n• Delivered in 24 hours\n\nDrone Add-on — $149\n• 10 aerial shots..."} />
            </div>
          )}

          {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}

          <div className="flex gap-3">
            <button onClick={handleImport} disabled={importing || !canImport}
              className="btn-primary px-6 py-2 text-sm flex-1 disabled:opacity-40">
              {importing ? "Importing…" : "Import"}
            </button>
            <button onClick={close} className="btn-outline px-4 py-2 text-sm">Cancel</button>
          </div>
          <p className="text-xs text-gray-400">
            All imported items are saved as inactive drafts. Toggle them Active when you're ready to publish.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const toast = useToast();
  const [activeType,  setActiveType]  = useState("packages");
  const [items,       setItems]       = useState({ packages: [], services: [], addons: [] });
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(null);
  const [search,      setSearch]      = useState("");
  const [teamMembers, setTeamMembers] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [pkgRes, svcRes, adnRes, teamRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/products?type=packages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=addons",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",                   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",                 { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [pkgData, svcData, adnData, teamData, tenantData] = await Promise.all([
        pkgRes.json(), svcRes.json(), adnRes.json(), teamRes.json(), tenantRes.json(),
      ]);
      setItems({
        packages: pkgData.items || [],
        services: svcData.items || [],
        addons:   adnData.items || [],
      });
      setTeamMembers(teamData.members || []);
      setPricingConfig(tenantData.tenant?.pricingConfig || null);
      setLoading(false);
    }
    auth.currentUser?.getIdToken().then(() => load());
  }, []);

  async function saveItem(payload, formType) {
    const token = await getToken();
    const { item, type: editingType } = editing;
    const type = formType || editingType;

    if (item) {
      await fetch(`/api/dashboard/products/${item.id}?type=${editingType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setItems((prev) => ({
        ...prev,
        [editingType]: prev[editingType].map((i) => (i.id === item.id ? { ...i, ...payload, id: item.id } : i)),
      }));
    } else {
      const res = await fetch(`/api/dashboard/products?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setItems((prev) => ({ ...prev, [type]: [...prev[type], data.item] }));
    }

    setEditing(null);
    toast("Saved successfully.");
  }

  async function deleteItem() {
    const token = await getToken();
    const { item, type } = editing;
    await fetch(`/api/dashboard/products/${item.id}?type=${type}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems((prev) => ({ ...prev, [type]: prev[type].filter((i) => i.id !== item.id) }));
    setEditing(null);
    toast("Product deleted.");
  }

  async function duplicateItem(item, type) {
    const token = await getToken();
    const { id: _id, ...rest } = item;
    const copy = { ...rest, name: `${item.name} (copy)` };
    const res  = await fetch(`/api/dashboard/products?type=${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(copy),
    });
    const data = await res.json();
    setItems((prev) => ({ ...prev, [type]: [...prev[type], data.item] }));
    toast("Product duplicated.");
  }

  async function toggleActive(item, type) {
    const token = await getToken();
    const newActive = item.active === false ? true : false;
    await fetch(`/api/dashboard/products/${item.id}?type=${type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...item, active: newActive }),
    });
    setItems((prev) => ({
      ...prev,
      [type]: prev[type].map((i) => (i.id === item.id ? { ...i, active: newActive } : i)),
    }));
  }

  // All hooks must be before any early return
  const serviceUsage = useMemo(() => {
    const map = {};
    items.services.forEach((svc) => {
      map[svc.id] = items.packages.filter((p) => p.includes?.includes(svc.id)).length;
    });
    return map;
  }, [items]);

  const current = useMemo(() => {
    const list = items[activeType] || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((i) =>
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.tagline?.toLowerCase().includes(q)
    );
  }, [items, activeType, search]);

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const addonTriggerLabel = (addon) => {
    const count = addon.showWith?.length || 0;
    if (count === 0) return "Always shown";
    return `${count} trigger${count !== 1 ? "s" : ""}`;
  };

  const packageServicesLabel = (pkg) => {
    const count = pkg.includes?.length || 0;
    return count > 0 ? `${count} service${count !== 1 ? "s" : ""}` : null;
  };

  const getExtraInfo = (item) => {
    if (activeType === "services") {
      const n = serviceUsage[item.id] || 0;
      const pkgStr = n > 0 ? `${n} pkg` : "No packages";
      const durStr = item.duration ? `${item.duration} min` : null;
      return durStr ? `${pkgStr} · ${durStr}` : pkgStr;
    }
    if (activeType === "addons") return addonTriggerLabel(item);
    if (activeType === "packages") return packageServicesLabel(item);
    return null;
  };

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Customize the services that appear on your booking page</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportPricingButton
            onImport={(imported) => {
              setItems((prev) => ({
                packages: [...(imported.packages || []), ...prev.packages],
                services: [...(imported.services || []), ...prev.services],
                addons:   [...(imported.addons   || []), ...prev.addons],
              }));
            }}
            activeType={activeType}
            pricingConfig={pricingConfig}
          />
          <button
            onClick={() => setEditing({ item: null, type: activeType })}
            className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            New Item
          </button>
        </div>
      </div>



      {/* Type tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <button key={type} onClick={() => { setActiveType(type); setSearch(""); }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeType === type ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {meta.label}
            <span className={`ml-1.5 text-xs ${activeType === type ? "text-gray-500" : "text-gray-400"}`}>({items[type].length})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={`Search ${TYPE_META[activeType].label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      {/* Product list */}
      <div className="card-section overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-400 uppercase tracking-[0.06em] font-medium"
          style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="w-12 flex-shrink-0" />
          <div className="flex-1">Product</div>
          <div className="w-32 flex-shrink-0 text-right">
            {activeType === "services" ? "In packages" : activeType === "addons" ? "Triggers" : "Services"}
          </div>
          <div className="w-28 flex-shrink-0 text-right">Price</div>
          <div className="w-9 flex-shrink-0 text-center">Active</div>
          <div className="w-24 flex-shrink-0 text-right">Actions</div>
        </div>

        {current.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            {search ? (
              <p className="font-medium text-gray-500">No results for "{search}"</p>
            ) : (
              <>
                <p className="font-medium text-gray-500">No {TYPE_META[activeType].label.toLowerCase()} yet</p>
                <p className="text-sm mt-1">Click "+ New Item" to add one.</p>
              </>
            )}
          </div>
        ) : (
          current.map((item) => (
            <ProductRow key={item.id} item={item} type={activeType}
              extraInfo={getExtraInfo(item)}
              onEdit={(i) => setEditing({ item: i, type: activeType })}
              onToggleActive={(i) => toggleActive(i, activeType)}
              onDuplicate={(i) => duplicateItem(i, activeType)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Changes take effect immediately on your booking page. Active products are visible to clients.
      </p>

      {/* Edit / create modal */}
      {editing && (
        <ProductForm
          item={editing.item}
          type={editing.type}
          allServices={items.services}
          allPackages={items.packages}
          teamMembers={teamMembers}
          pricingConfig={pricingConfig}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
