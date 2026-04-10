"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

// ─── Image thumbnail with loading/error ───────────────────────────────────────
function MediaThumb({ src, alt, isFirst, isDragging, category, categories,
  onDragStart, onDragOver, onDrop, onDragEnd, index, onAssignCategory,
  selected, onSelect }) {
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`aspect-square rounded-sm overflow-hidden bg-gray-100 relative group cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-40 scale-95" : ""}
        ${selected ? "ring-2 ring-gold ring-offset-1" : ""}
        transition-all duration-150`}
    >
      {!loaded && !errored && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
      {errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs mt-1">No preview</span>
        </div>
      )}
      <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        crossOrigin="anonymous" />

      {/* Selection checkbox */}
      <div
        className={`absolute top-1.5 left-1.5 z-10 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer
          ${selected ? "bg-gold border-gold" : "bg-white/80 border-white/60 hover:border-gold"}`}>
          {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#0b2a55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-end gap-1 p-1.5">
        {/* Category picker */}
        {categories.length > 0 && (
          <select
            value={category || ""}
            onChange={(e) => onAssignCategory(e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-white/90 text-charcoal rounded px-1.5 py-0.5 w-full cursor-pointer"
          >
            <option value="">No category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {isFirst && !selected && (
        <div className="absolute top-1.5 right-1.5">
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-navy text-white">Cover</span>
        </div>
      )}
      {category && (
        <div className="absolute bottom-6 right-1.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-sm bg-black/60 text-white truncate max-w-[80px]">{category}</span>
        </div>
      )}
      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center font-bold">
        {index + 1}
      </div>
    </div>
  );
}

// ─── Email tag input ──────────────────────────────────────────────────────────
function EmailTagInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState("");
  function addEmail(raw) {
    const emails = raw.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (emails.length) onChange([...value, ...emails]);
    setInput("");
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="input-field min-h-10 flex flex-wrap gap-1.5 p-2 cursor-text"
        onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
        {value.map((email, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-navy/10 text-navy text-xs px-2 py-0.5 rounded-sm">
            {email}
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="hover:text-red-500 leading-none text-base">&times;</button>
          </span>
        ))}
        <input type="email" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter","Tab",",",";"].includes(e.key)) { e.preventDefault(); if (input.trim()) addEmail(input); }
            if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0,-1));
          }}
          onBlur={() => { if (input.trim()) addEmail(input); }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add multiple</p>
    </div>
  );
}

// ─── Rich text email editor ───────────────────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);

  // Sync external value only on mount
  useEffect(() => {
    if (editorRef.current && value === "") {
      editorRef.current.innerHTML = "";
    }
  }, []);

  function exec(cmd, val = null) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  }

  function handleInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function insertLink() {
    if (!linkUrl) return;
    const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    exec("createLink", url);
    setShowLink(false);
    setLinkUrl("");
  }

  const ToolBtn = ({ cmd, val, title, children, onClick }) => (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick ? onClick() : exec(cmd, val); }}
      className="p-1.5 rounded hover:bg-gray-200 text-charcoal transition-colors text-sm font-medium w-7 h-7 flex items-center justify-center">
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
        <ToolBtn cmd="bold"   title="Bold">   <strong>B</strong></ToolBtn>
        <ToolBtn cmd="italic" title="Italic"> <em>I</em></ToolBtn>
        <ToolBtn cmd="strikeThrough" title="Strikethrough">
          <span style={{textDecoration:"line-through"}}>S</span>
        </ToolBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolBtn cmd="insertUnorderedList" title="Bullet list">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </ToolBtn>
        <ToolBtn cmd="insertOrderedList" title="Numbered list">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7m2 4H7m2 4H7m2 4H7M5 5v14" />
          </svg>
        </ToolBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolBtn title="Link" onClick={() => setShowLink((v) => !v)}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolBtn>
        <ToolBtn cmd="removeFormat" title="Clear formatting">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ToolBtn>
      </div>

      {/* Link input */}
      {showLink && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 border-b border-blue-100">
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && insertLink()}
            placeholder="https://example.com"
            className="flex-1 text-sm bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:border-blue-400" />
          <button type="button" onClick={insertLink}
            className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-2.5 py-1 rounded">
            Insert
          </button>
          <button type="button" onClick={() => setShowLink(false)} className="text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="min-h-[80px] px-3 py-2.5 text-sm text-charcoal outline-none prose prose-sm max-w-none
          [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 [&:empty]:before:pointer-events-none"
        style={{ lineHeight: "1.6" }}
      />
    </div>
  );
}

// ─── Main gallery page ────────────────────────────────────────────────────────
export default function GalleryDetailPage() {
  const { id } = useParams();
  const [gallery,      setGallery]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [msg,          setMsg]          = useState({ text: "", type: "" });
  const [showDeliver,  setShowDeliver]  = useState(false);
  const [delivering,   setDelivering]   = useState(false);
  const [activeTab,    setActiveTab]    = useState("all");
  const [dragIdx,      setDragIdx]      = useState(null);
  const [savingOrder,  setSavingOrder]  = useState(false);
  const fileRef = useRef(null);

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailTo,      setEmailTo]      = useState([]);
  const [emailCc,      setEmailCc]      = useState([]);
  const [emailNote,    setEmailNote]    = useState(""); // HTML string

  // Category state
  const [showCatPanel,  setShowCatPanel]  = useState(false);
  const [newCatName,    setNewCatName]    = useState("");
  // categories: { catName: [mediaKey, ...] }
  const [categories,    setCategories]    = useState({});
  const [savingCats,    setSavingCats]    = useState(false);

  // Bulk selection state
  const [selectedKeys,    setSelectedKeys]    = useState(new Set());
  const [bulkCatTarget,   setBulkCatTarget]   = useState("");

  // 3D / floor plans / files state
  const [matterportUrl,   setMatterportUrl]   = useState("");
  const [virtualLinks,    setVirtualLinks]    = useState([]); // [{label, url}]
  const [floorPlans,      setFloorPlans]      = useState([]); // [{url, key, fileName}]
  const [attachedFiles,   setAttachedFiles]   = useState([]); // [{url, key, fileName, fileType}]
  const [savingExtras,    setSavingExtras]    = useState(false);
  const [uploadingFloor,  setUploadingFloor]  = useState(false);
  const [uploadingFile,   setUploadingFile]   = useState(false);
  const [newLinkLabel,    setNewLinkLabel]    = useState("");
  const [newLinkUrl,      setNewLinkUrl]      = useState("");
  const floorRef = useRef(null);
  const fileAttachRef = useRef(null);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [galleryRes, tenantRes] = await Promise.all([
        fetch(`/api/dashboard/galleries/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",           { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (galleryRes.ok) {
        const data = await galleryRes.json();
        setGallery(data.gallery);
        setCategories(data.gallery.categories || {});

        // Pre-populate email from template if available, fall back to default subject
        let defaultSubject = `Your listing media is ready — ${data.gallery.bookingAddress || ""}`;
        let defaultNote = "";
        if (tenantRes.ok) {
          const tData = await tenantRes.json();
          const tpl = tData.tenant?.emailTemplate;
          if (tpl?.subject) {
            defaultSubject = tpl.subject.replace("{{address}}", data.gallery.bookingAddress || "");
          }
          if (tpl?.body) {
            defaultNote = tpl.body.replace("{{clientName}}", data.gallery.clientName || "");
          }
        }
        setEmailSubject(defaultSubject);
        if (defaultNote) setEmailNote(defaultNote);
        if (data.gallery.clientEmail) setEmailTo([data.gallery.clientEmail]);

        // Load extras
        if (data.gallery.matterportUrl) setMatterportUrl(data.gallery.matterportUrl);
        if (data.gallery.virtualLinks)  setVirtualLinks(data.gallery.virtualLinks);
        if (data.gallery.floorPlans)    setFloorPlans(data.gallery.floorPlans);
        if (data.gallery.attachedFiles) setAttachedFiles(data.gallery.attachedFiles);
      }
      setLoading(false);
    });
  }, [id]);

  // ─── Upload ──────────────────────────────────────────────────────────────
  async function uploadFiles(files) {
    setUploading(true); setProgress(0); setMsg({ text: "", type: "" });
    const token = await auth.currentUser.getIdToken();
    const total = files.length;
    let done = 0;
    const errors = [];

    for (const file of files) {
      try {
        // Step 1 — get presigned URL
        const urlRes = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, galleryId: id }),
        });
        if (!urlRes.ok) {
          const errData = await urlRes.json().catch(() => ({}));
          const msg = errData.error || `HTTP ${urlRes.status}`;
          errors.push(`${file.name}: ${msg}`);
          continue;
        }
        const { uploadUrl, publicUrl, key, error: urlError } = await urlRes.json();
        if (urlError || !uploadUrl) {
          errors.push(`${file.name}: ${urlError || "No upload URL returned"}`);
          continue;
        }

        // Step 2 — PUT to R2 (no Content-Type header — avoids signing mismatch)
        const putHeaders = {};
        if (file.type) putHeaders["Content-Type"] = file.type;
        const r2Res = await fetch(uploadUrl, { method: "PUT", body: file, headers: putHeaders });
        if (!r2Res.ok) {
          const r2Body = await r2Res.text().catch(() => "");
          errors.push(`${file.name}: R2 storage error ${r2Res.status}${r2Body ? ` — ${r2Body.slice(0, 120)}` : ""}`);
          continue;
        }

        // Step 3 — save to Firestore
        const saveRes = await fetch(`/api/dashboard/galleries/${id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicUrl, key, fileName: file.name, fileType: file.type }),
        });
        if (!saveRes.ok) {
          const saveData = await saveRes.json().catch(() => ({}));
          errors.push(`${file.name}: Save failed (${saveRes.status}) — ${saveData.error || "check auth"}`);
          continue;
        }

        done++;
        setProgress(Math.round((done / total) * 100));
        setGallery((g) => ({
          ...g,
          media: [...(g.media || []), { url: publicUrl, key, fileName: file.name, fileType: file.type }],
        }));
      } catch (err) {
        errors.push(`${file.name}: ${err.message || "Network error"}`);
      }
    }

    setUploading(false);

    if (done > 0 && errors.length === 0) {
      setMsg({ text: `${done} file${done !== 1 ? "s" : ""} uploaded.`, type: "success" });
    } else if (done > 0 && errors.length > 0) {
      setMsg({ text: `${done} uploaded, ${errors.length} failed: ${errors[0]}`, type: "error" });
    } else {
      // All failed — show the first error clearly
      setMsg({ text: errors[0] || "Upload failed. Check R2 env vars in Vercel.", type: "error" });
    }
  }

  // ─── Drag reorder ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const handleDrop      = useCallback(async (e, toIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); return; }
    setGallery((g) => {
      const list = [...(g.media || [])];
      const [moved] = list.splice(dragIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...g, media: list };
    });
    setDragIdx(null);
  }, [dragIdx]);
  const handleDragEnd = useCallback(() => setDragIdx(null), []);

  async function saveOrder() {
    setSavingOrder(true);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ media: gallery.media }),
    });
    setSavingOrder(false);
    setMsg({ text: "Order saved.", type: "success" });
  }

  // ─── Category helpers ─────────────────────────────────────────────────────
  function getMediaCategory(key) {
    for (const [cat, keys] of Object.entries(categories)) {
      if (keys.includes(key)) return cat;
    }
    return null;
  }

  function assignCategory(mediaKey, catName) {
    setCategories((prev) => {
      const next = {};
      // Remove from any existing category
      for (const [cat, keys] of Object.entries(prev)) {
        next[cat] = keys.filter((k) => k !== mediaKey);
      }
      // Add to new category
      if (catName && next[catName] !== undefined) {
        next[catName] = [...next[catName], mediaKey];
      } else if (catName) {
        next[catName] = [mediaKey];
      }
      return next;
    });
  }

  // ─── Bulk selection helpers ───────────────────────────────────────────────
  function toggleSelect(key) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelectedKeys(new Set(displayImages.map((m) => m.key).filter(Boolean)));
  }

  function clearSelection() {
    setSelectedKeys(new Set());
    setBulkCatTarget("");
  }

  function applyBulkCategory() {
    if (!bulkCatTarget) return;
    setCategories((prev) => {
      const next = {};
      for (const [cat, keys] of Object.entries(prev)) {
        next[cat] = keys.filter((k) => !selectedKeys.has(k));
      }
      next[bulkCatTarget] = [...(next[bulkCatTarget] || []), ...Array.from(selectedKeys)];
      return next;
    });
    clearSelection();
    setMsg({ text: `Assigned ${selectedKeys.size} photos to "${bulkCatTarget}".`, type: "success" });
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name || categories[name]) return;
    setCategories((prev) => ({ ...prev, [name]: [] }));
    setNewCatName("");
  }

  function deleteCategory(cat) {
    setCategories((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  }

  async function saveCategories() {
    setSavingCats(true);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ categories }),
    });
    setSavingCats(false);
    setGallery((g) => ({ ...g, categories }));
    setMsg({ text: "Categories saved.", type: "success" });
    setShowCatPanel(false);
  }

  // ─── Deliver ──────────────────────────────────────────────────────────────
  async function deliverGallery() {
    if (emailTo.length === 0) { setMsg({ text: "Add at least one recipient.", type: "error" }); setShowDeliver(false); return; }
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: emailSubject, note: emailNote, to: emailTo, cc: emailCc }),
    });
    setDelivering(false); setShowDeliver(false);
    if (res.ok) { setMsg({ text: "Gallery delivered.", type: "success" }); setGallery((g) => ({ ...g, delivered: true })); }
    else setMsg({ text: "Failed to send email.", type: "error" });
  }

  async function toggleUnlock() {
    const token = await auth.currentUser.getIdToken();
    const newVal = !gallery.unlocked;
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unlocked: newVal }),
    });
    setGallery((g) => ({ ...g, unlocked: newVal }));
  }

  async function saveExtras() {
    setSavingExtras(true);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matterportUrl, virtualLinks, floorPlans, attachedFiles }),
    });
    setSavingExtras(false);
    setMsg({ text: "Saved.", type: "success" });
  }

  async function uploadToR2(file, subfolder) {
    const token = await auth.currentUser.getIdToken();
    const urlRes = await fetch("/api/gallery/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileName: `${subfolder}/${file.name}`, fileType: file.type, galleryId: id }),
    });
    if (!urlRes.ok) { const d = await urlRes.json(); throw new Error(d.error || "Failed to get upload URL"); }
    const { uploadUrl, publicUrl, key } = await urlRes.json();
    const putHeaders = {};
    if (file.type) putHeaders["Content-Type"] = file.type;
    const r2Res = await fetch(uploadUrl, { method: "PUT", body: file, headers: putHeaders });
    if (!r2Res.ok) throw new Error(`R2 upload failed: ${r2Res.status}`);
    return { publicUrl, key, fileName: file.name, fileType: file.type };
  }

  async function uploadFloorPlans(files) {
    setUploadingFloor(true);
    const results = [];
    for (const file of files) {
      try {
        const result = await uploadToR2(file, "floorplans");
        results.push(result);
      } catch (err) {
        setMsg({ text: `Floor plan upload failed: ${err.message}`, type: "error" });
      }
    }
    const updated = [...floorPlans, ...results];
    setFloorPlans(updated);
    setUploadingFloor(false);
    // Auto-save
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ floorPlans: updated }),
    });
    if (results.length) setMsg({ text: `${results.length} floor plan${results.length !== 1 ? "s" : ""} added.`, type: "success" });
  }

  async function uploadAttachedFile(files) {
    setUploadingFile(true);
    const results = [];
    for (const file of files) {
      try {
        const result = await uploadToR2(file, "attachments");
        results.push(result);
      } catch (err) {
        setMsg({ text: `File upload failed: ${err.message}`, type: "error" });
      }
    }
    const updated = [...attachedFiles, ...results];
    setAttachedFiles(updated);
    setUploadingFile(false);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ attachedFiles: updated }),
    });
    if (results.length) setMsg({ text: `${results.length} file${results.length !== 1 ? "s" : ""} attached.`, type: "success" });
  }

  function addVirtualLink() {
    if (!newLinkUrl) return;
    const label = newLinkLabel.trim() || "Virtual Tour";
    const url   = newLinkUrl.startsWith("http") ? newLinkUrl : `https://${newLinkUrl}`;
    setVirtualLinks((prev) => [...prev, { label, url }]);
    setNewLinkLabel(""); setNewLinkUrl("");
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );
  if (!gallery) return <div className="p-8 text-gray-500">Gallery not found.</div>;

  const allMedia   = gallery.media || [];
  const images     = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos     = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const coverImg   = images[0]?.url || null;
  const catNames   = Object.keys(categories);
  const galleryUrl = gallery.accessToken
    ? `${APP_URL}/${gallery.tenantSlug || ""}/gallery/${gallery.accessToken}`
    : null;

  // Determine what images to show in current tab
  let displayImages = images;
  if (activeTab !== "all" && activeTab !== "videos") {
    const catKeys = categories[activeTab] || [];
    displayImages = images.filter((m) => catKeys.includes(m.key));
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative h-44 bg-gray-900 overflow-hidden">
        {coverImg && <img src={coverImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" crossOrigin="anonymous" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-white text-xl">{gallery.bookingAddress || "Gallery"}</h1>
            <p className="text-white/60 text-xs mt-0.5">{allMedia.length} items</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            gallery.delivered ? "bg-green-500 text-white" :
            gallery.unlocked  ? "bg-blue-500 text-white" : "bg-amber-400 text-white"
          }`}>
            {gallery.delivered ? "Delivered" : gallery.unlocked ? "Unlocked" : "Draft"}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard/galleries" className="text-sm text-gray-400 hover:text-navy">← All galleries</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCatPanel(true)} className="btn-outline text-xs px-3 py-1.5">
              📁 Categories ({catNames.length})
            </button>
            <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
              {gallery.unlocked ? "🔓 Unlocked" : "🔒 Locked"}
            </button>
            <button onClick={() => setShowDeliver(true)} className="btn-primary text-sm px-5 py-2">
              Deliver to Client
            </button>
          </div>
        </div>

        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-sm mb-4 ${
            msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
          }`}>{msg.text}</div>
        )}

        {/* Upload zone */}
        <div className="border-2 border-dashed border-gray-200 rounded-sm p-6 mb-6 text-center cursor-pointer hover:border-navy/40 hover:bg-gray-50 transition-colors"
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
            if (files.length) uploadFiles(files);
          }}>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e) => e.target.files?.length && uploadFiles(Array.from(e.target.files))} />
          {uploading ? (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2 max-w-xs mx-auto">
                <div className="bg-navy h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-500">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-1">☁️</p>
              <p className="text-sm text-gray-500">Drop files or <span className="text-navy font-medium">click to upload</span></p>
              <p className="text-xs text-gray-400 mt-1">Full-res photos and videos</p>
            </>
          )}
        </div>

        {/* Tabs */}
        {allMedia.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
                {[
                  { id: "all",    label: `All (${images.length})` },
                  ...catNames.map((c) => ({ id: c, label: `${c} (${(categories[c] || []).length})` })),
                  ...(videos.length > 0 ? [{ id: "videos", label: `Videos (${videos.length})` }] : []),
                ].map((t) => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === t.id ? "border-navy text-navy" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <p className="text-xs text-gray-400 hidden md:block">Drag to reorder · first = cover</p>
                <button onClick={saveOrder} disabled={savingOrder} className="text-xs btn-outline px-3 py-1">
                  {savingOrder ? "Saving…" : "Save Order"}
                </button>
              </div>
            </div>

            {activeTab !== "videos" && (
              <>
                {/* Bulk selection toolbar */}
                {selectedKeys.size > 0 && (
                  <div className="flex items-center gap-3 bg-navy/5 border border-navy/20 rounded-sm px-3 py-2 mb-3">
                    <span className="text-sm font-semibold text-navy">{selectedKeys.size} selected</span>
                    {catNames.length > 0 && (
                      <>
                        <select
                          value={bulkCatTarget}
                          onChange={(e) => setBulkCatTarget(e.target.value)}
                          className="text-xs input-field py-1 flex-1 max-w-xs"
                        >
                          <option value="">Assign to category…</option>
                          {catNames.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          onClick={applyBulkCategory}
                          disabled={!bulkCatTarget}
                          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                        >
                          Apply
                        </button>
                      </>
                    )}
                    <button onClick={selectAll} className="text-xs text-navy border border-navy/20 px-2 py-1 rounded hover:bg-navy/5">
                      Select all
                    </button>
                    <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-red-500 ml-auto">
                      Clear
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {displayImages.map((m, i) => (
                    <MediaThumb
                      key={m.key || i}
                      src={m.url} alt={m.fileName || `Photo ${i+1}`}
                      isFirst={i === 0 && activeTab === "all"}
                      index={i}
                      isDragging={dragIdx === i}
                      category={getMediaCategory(m.key)}
                      categories={catNames}
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i)}
                      onDragEnd={handleDragEnd}
                      onAssignCategory={(cat) => assignCategory(m.key, cat)}
                      selected={selectedKeys.has(m.key)}
                      onSelect={() => m.key && toggleSelect(m.key)}
                    />
                  ))}
                </div>
              </>
            )}

            {activeTab === "videos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((v, i) => (
                  <div key={v.key || i}>
                    <video src={v.url} controls className="w-full rounded-sm" />
                    <p className="text-xs text-gray-400 truncate mt-1">{v.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Extras: 3D / Floor Plans / Files ─────────────────────────────── */}
      <div className="px-6 pb-8 space-y-5 max-w-3xl">
        <div className="border-t border-gray-100 pt-6">
          <h2 className="font-display text-navy text-base mb-1">Property Extras</h2>
          <p className="text-xs text-gray-400 mb-5">Add 3D tours, floor plans, and documents — all delivered alongside photos in the client gallery.</p>

          {/* 3D / Matterport */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-sm bg-navy/8 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-navy">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-charcoal">3D Tour Link</p>
                <p className="text-xs text-gray-400">Paste your Matterport, iGuide, Zillow 3D, or similar URL — it will be embedded in the client gallery.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={matterportUrl}
                onChange={(e) => setMatterportUrl(e.target.value)}
                placeholder="https://my.matterport.com/show/?m=..."
                className="input-field flex-1 text-sm"
              />
              <button onClick={saveExtras} disabled={savingExtras} className="btn-primary px-4 py-2 text-xs whitespace-nowrap">
                {savingExtras ? "Saving…" : "Save"}
              </button>
            </div>
            {matterportUrl && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                3D tour will appear as an interactive embed in the client gallery.
              </p>
            )}
          </div>

          {/* Floor Plans */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-navy/8 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-navy">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">2D Floor Plans</p>
                  <p className="text-xs text-gray-400">PNG, JPG, or PDF</p>
                </div>
              </div>
              <button onClick={() => floorRef.current?.click()} disabled={uploadingFloor}
                className="btn-outline text-xs px-3 py-1.5">
                {uploadingFloor ? "Uploading…" : "+ Upload"}
              </button>
              <input ref={floorRef} type="file" multiple accept="image/*,.pdf" className="hidden"
                onChange={(e) => e.target.files?.length && uploadFloorPlans(Array.from(e.target.files))} />
            </div>
            {floorPlans.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No floor plans uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {floorPlans.map((fp, i) => (
                  <div key={fp.key || i} className="relative group rounded-sm overflow-hidden border border-gray-100 bg-gray-50">
                    {fp.fileType?.includes("pdf") ? (
                      <a href={fp.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 text-xs text-navy font-medium hover:bg-gray-100 transition-colors">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{fp.fileName}</span>
                      </a>
                    ) : (
                      <img src={fp.url} alt={fp.fileName} className="w-full aspect-[4/3] object-cover" />
                    )}
                    <button onClick={() => setFloorPlans((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attached files / documents */}
          <div className="bg-white border border-gray-100 rounded-sm p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-navy/8 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-navy">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Documents & Files</p>
                  <p className="text-xs text-gray-400">PDF, Word, ZIP, or any other file</p>
                </div>
              </div>
              <button onClick={() => fileAttachRef.current?.click()} disabled={uploadingFile}
                className="btn-outline text-xs px-3 py-1.5">
                {uploadingFile ? "Uploading…" : "+ Attach"}
              </button>
              <input ref={fileAttachRef} type="file" multiple className="hidden"
                onChange={(e) => e.target.files?.length && uploadAttachedFile(Array.from(e.target.files))} />
            </div>
            {attachedFiles.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No files attached.</p>
            ) : (
              <div className="space-y-1.5">
                {attachedFiles.map((f, i) => (
                  <div key={f.key || i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-sm group">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-navy hover:underline truncate flex-1">{f.fileName}</a>
                    <span className="text-[10px] text-gray-300 flex-shrink-0">{f.fileType?.split("/")[1]?.toUpperCase() || "FILE"}</span>
                    <button onClick={() => setAttachedFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none ml-1">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category panel */}
      {showCatPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-navy text-lg">Manage Categories</h2>
              <button onClick={() => setShowCatPanel(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Create folders to organize photos. Assign photos to categories from the gallery grid.</p>
              <div className="flex gap-2">
                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="Category name (e.g. Exterior)" className="input-field flex-1" />
                <button onClick={addCategory} className="btn-primary px-4 py-2.5 text-sm whitespace-nowrap">Add</button>
              </div>
              {catNames.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No categories yet.</p>
              ) : (
                <div className="space-y-1">
                  {catNames.map((cat) => (
                    <div key={cat} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-sm">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{cat}</p>
                        <p className="text-xs text-gray-400">{(categories[cat] || []).length} photos</p>
                      </div>
                      <button onClick={() => deleteCategory(cat)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCatPanel(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveCategories} disabled={savingCats} className="btn-primary px-6 py-2 text-sm">
                {savingCats ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-display text-navy text-lg">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <EmailTagInput label="To" value={emailTo} onChange={setEmailTo}
                placeholder={gallery.clientEmail || "client@example.com"} />
              <EmailTagInput label="CC (optional)" value={emailCc} onChange={setEmailCc} placeholder="Add CC recipients…" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Personal Note (optional)
                </label>
                <RichTextEditor value={emailNote} onChange={setEmailNote}
                  placeholder="Great shoot today! Let me know if you need anything adjusted." />
              </div>

              {/* Email preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-xs text-gray-400 uppercase tracking-wide mb-3">Email preview</p>
                <p>Hi <strong>{gallery.clientName || "there"}</strong>,</p>
                {emailNote && (
                  <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: emailNote }} />
                )}
                <p>Your media for <strong>{gallery.bookingAddress}</strong> is ready to view and download.</p>
                {galleryUrl ? (
                  <a href={galleryUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-navy font-semibold underline hover:text-navy-light">
                    [ View Gallery → ]
                  </a>
                ) : (
                  <p className="text-navy font-semibold">[ View Gallery ]</p>
                )}
                <p className="text-gray-400 text-xs mt-3">— {gallery.tenantName || "Your photographer"}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button onClick={deliverGallery} disabled={delivering || emailTo.length === 0} className="btn-primary px-6 py-2 text-sm">
                {delivering ? "Sending…" : `Deliver to ${emailTo.length + emailCc.length} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
