"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";

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
function ProductForm({ item, type, allServices, teamMembers, onSave, onDelete, onClose }) {
  const [form,    setForm]    = useState(() => ({
    name:         item?.name         || "",
    description:  item?.description  || "",
    mediaUrls:    item?.mediaUrls    || (item?.thumbnailUrl ? [item.thumbnailUrl] : []),
    price:        item?.price        || 0,
    tagline:      item?.tagline      || "",
    deliverables: item?.deliverables || "",
    active:       item?.active !== false,
    featured:     item?.featured     || false,
    tiered:       !!(item?.priceTiers),
    priceTiers:   item?.priceTiers || { Tiny: 0, Small: 0, Medium: 0, Large: 0, XL: 0, XXL: 0 },
    includes:     item?.includes     || [],
    assignedPhotographers: item?.assignedPhotographers || [],
  }));
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [uploading, setUploading] = useState(false);
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
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(idx) {
    setForm((f) => ({ ...f, mediaUrls: f.mediaUrls.filter((_, i) => i !== idx) }));
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
    };
    await onSave(payload);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-display text-navy text-lg">
            {item ? `Edit ${TYPE_META[type].singular}` : `New ${TYPE_META[type].singular}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Preview */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-20 h-20 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
              {form.mediaUrls[0]
                ? <img src={form.mediaUrls[0]} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🏠</div>
              }
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-charcoal truncate">{form.name || "Product Name"}</p>
              {form.tagline && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{form.tagline}</p>}
              {!form.tagline && form.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{form.description}</p>
              )}
              <p className="text-sm font-semibold text-charcoal mt-1">
                {form.tiered ? `From $${Math.min(...Object.values(form.priceTiers).filter(v => v > 0), form.price || 0).toLocaleString()}` : `$${Number(form.price).toLocaleString()}`}
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
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                    {url.match(/\.(mp4|mov|webm)$/i)
                      ? <video src={url} className="w-full h-full object-cover" />
                      : <img src={url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                    }
                    {idx === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5">Cover</div>
                    )}
                    <button type="button" onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      ×
                    </button>
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
                <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
                  {allServices.map((svc) => (
                    <label key={svc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.includes.includes(svc.id)}
                        onChange={() => toggleService(svc.id)} className="rounded" />
                      <span className="text-sm text-charcoal">{svc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="featured" checked={form.featured} onChange={field("featured")} className="rounded" />
                <label htmlFor="featured" className="text-sm font-medium text-charcoal cursor-pointer">
                  Mark as featured / Most Popular
                </label>
              </div>
            </>
          )}

          {/* Pricing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label-field mb-0">Pricing</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">Sq. ft. tier pricing</span>
                <div
                  onClick={() => setForm((f) => ({ ...f, tiered: !f.tiered }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.tiered ? "bg-navy" : "bg-gray-300"}`}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SQFT_TIERS.map((tier) => (
                  <div key={tier}>
                    <label className="block text-xs text-gray-500 mb-1">{tier} <span className="text-gray-400">({TIER_LABELS[tier]})</span></label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">$</span>
                      <input type="number" value={form.priceTiers[tier] || ""} onChange={tierField(tier)}
                        min="0" step="1" className="input-field py-1.5 text-sm w-full" placeholder="0" />
                    </div>
                  </div>
                ))}
              </div>
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
                        ? "bg-charcoal text-white border-charcoal"
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

          {/* Active toggle */}
          <div className="flex items-center gap-3 pt-1">
            <input type="checkbox" id="active" checked={form.active} onChange={field("active")} className="rounded" />
            <label htmlFor="active" className="text-sm text-charcoal cursor-pointer">
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
function ProductRow({ item, type, onEdit, onToggleActive, onDuplicate }) {
  const fromPrice = item.priceTiers
    ? `From $${Math.min(...Object.values(item.priceTiers).filter(v => v > 0), item.price || 0).toLocaleString()}`
    : `$${(item.price || 0).toLocaleString()}`;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* Thumb */}
      <div className="w-12 h-12 rounded-sm bg-gray-100 overflow-hidden flex-shrink-0">
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          : <div className="w-full h-full flex items-center justify-center text-lg opacity-20">🏠</div>
        }
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-charcoal truncate">{item.name}</p>
          {type === "packages" && item.featured && (
            <span className="text-xs px-1.5 py-0.5 bg-gold/20 text-gold-dark rounded-sm font-medium flex-shrink-0">
              Featured
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
        )}
      </div>

      {/* Price */}
      <p className="text-sm font-semibold text-navy flex-shrink-0 w-28 text-right">{fromPrice}</p>

      {/* Active toggle */}
      <div
        onClick={() => onToggleActive(item)}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${item.active !== false ? "bg-navy" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.active !== false ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={() => onDuplicate(item)}
          title="Duplicate"
          className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1.5 rounded-sm hover:bg-gray-50">
          Copy
        </button>
        <button onClick={() => onEdit(item)}
          className="text-xs text-navy border border-navy/20 px-3 py-1.5 rounded-sm hover:bg-navy/5">
          Edit
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [activeType,  setActiveType]  = useState("packages");
  const [items,       setItems]       = useState({ packages: [], services: [], addons: [] });
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(null);
  const [msg,         setMsg]         = useState("");
  const [teamMembers, setTeamMembers] = useState([]);

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [pkgRes, svcRes, adnRes, teamRes] = await Promise.all([
        fetch("/api/dashboard/products?type=packages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=addons",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",                   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [pkgData, svcData, adnData, teamData] = await Promise.all([
        pkgRes.json(), svcRes.json(), adnRes.json(), teamRes.json(),
      ]);
      setItems({
        packages: pkgData.items || [],
        services: svcData.items || [],
        addons:   adnData.items || [],
      });
      setTeamMembers(teamData.members || []);
      setLoading(false);
    }
    auth.currentUser?.getIdToken().then(() => load());
  }, []);

  async function saveItem(payload) {
    const token = await getToken();
    const { item, type } = editing;

    if (item) {
      // update
      await fetch(`/api/dashboard/products/${item.id}?type=${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setItems((prev) => ({
        ...prev,
        [type]: prev[type].map((i) => (i.id === item.id ? { ...i, ...payload, id: item.id } : i)),
      }));
    } else {
      // create
      const res  = await fetch(`/api/dashboard/products?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setItems((prev) => ({ ...prev, [type]: [...prev[type], data.item] }));
    }

    setEditing(null);
    setMsg("Saved successfully.");
    setTimeout(() => setMsg(""), 3000);
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
    setMsg("Product deleted.");
    setTimeout(() => setMsg(""), 3000);
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
    setMsg("Product duplicated.");
    setTimeout(() => setMsg(""), 3000);
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

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const current = items[activeType] || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Products</h1>
          <p className="text-gray-400 text-sm mt-0.5">Customize the services that appear on your booking page</p>
        </div>
        <button
          onClick={() => setEditing({ item: null, type: activeType })}
          className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          New {TYPE_META[activeType].singular}
        </button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-sm mb-4">
          {msg}
        </div>
      )}

      {/* Type tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <button key={type} onClick={() => setActiveType(type)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeType === type ? "border-navy text-navy" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {meta.label}
            <span className="ml-1.5 text-xs text-gray-400">({items[type].length})</span>
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="bg-white border border-gray-200 rounded-sm divide-y divide-gray-50">
        {/* Header */}
        <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-400 uppercase tracking-wide font-medium">
          <div className="col-span-1" />
          <div className="col-span-5">Product</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-center">Active</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {current.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="font-medium text-gray-500">No {TYPE_META[activeType].label.toLowerCase()} yet</p>
            <p className="text-sm mt-1">Click "New {TYPE_META[activeType].singular}" to add one.</p>
          </div>
        ) : (
          current.map((item) => (
            <ProductRow key={item.id} item={item} type={activeType}
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
          teamMembers={teamMembers}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
