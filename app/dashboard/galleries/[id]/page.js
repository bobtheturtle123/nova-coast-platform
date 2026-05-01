"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

// ─── Image thumbnail with loading/error ───────────────────────────────────────
function MediaThumb({ src, alt, isFirst, isDragging, category, categories,
  onDragStart, onDragOver, onDrop, onDragEnd, index, onAssignCategory,
  selected, onSelect, onDelete, selectMode, hidden, onToggleHide }) {
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      draggable={!selectMode}
      onDragStart={!selectMode ? onDragStart : undefined}
      onDragOver={!selectMode ? onDragOver : undefined}
      onDrop={!selectMode ? onDrop : undefined}
      onDragEnd={!selectMode ? onDragEnd : undefined}
      onClick={selectMode ? (e) => { e.stopPropagation(); onSelect?.(); } : undefined}
      className={`aspect-square rounded-xl overflow-hidden bg-gray-100 relative group
        ${selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
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
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? (hidden ? "opacity-30" : "opacity-100") : "opacity-0"}`} />

      {/* Selection checkbox — always visible in select mode, hover-only otherwise */}
      <div
        className={`absolute top-1.5 left-1.5 z-10 transition-opacity ${selected || selectMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer
          ${selected ? "bg-gold border-gold" : "bg-white/80 border-white/60 hover:border-gold"}`}>
          {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#3486cf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-end gap-1 p-1.5">
        {/* Delete button (top-right) */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center transition-colors"
          title="Delete photo"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Hide / show button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHide?.(); }}
          className="absolute top-1.5 right-8 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          title={hidden ? "Show in client gallery" : "Hide from client gallery"}
        >
          {hidden ? (
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>
        {/* Category picker */}
        {categories.length > 0 && (
          <select
            value={category || ""}
            onChange={(e) => onAssignCategory(e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-white/90 text-[#0F172A] rounded px-1.5 py-0.5 w-full cursor-pointer"
          >
            <option value="">No category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {isFirst && !selected && (
        <div className="absolute top-1.5 left-7">
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-xl bg-[#3486cf] text-white">Cover</span>
        </div>
      )}
      {hidden && (
        <div className="absolute top-1.5 left-7">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-xl bg-gray-700/80 text-white">Hidden</span>
        </div>
      )}
      {category && (
        <div className="absolute bottom-6 right-1.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-xl bg-black/60 text-white truncate max-w-[80px]">{category}</span>
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
          <span key={i} className="inline-flex items-center gap-1 bg-[#3486cf]/10 text-[#3486cf] text-xs px-2 py-0.5 rounded-xl">
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
      className="p-1.5 rounded hover:bg-gray-200 text-[#0F172A] transition-colors text-sm font-medium w-7 h-7 flex items-center justify-center">
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
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
        className="min-h-[80px] px-3 py-2.5 text-sm text-[#0F172A] outline-none prose prose-sm max-w-none
          [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 [&:empty]:before:pointer-events-none"
        style={{ lineHeight: "1.6" }}
      />
    </div>
  );
}

// ─── Main gallery page ────────────────────────────────────────────────────────
export default function GalleryDetailPage() {
  const { id }   = useParams();
  const toast    = useToast();
  const [gallery,      setGallery]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [showDeliver,  setShowDeliver]  = useState(false);
  const [delivering,   setDelivering]   = useState(false);
  const [activeTab,    setActiveTab]    = useState("all");
  const [dragIdx,      setDragIdx]      = useState(null);
  const [savingOrder,  setSavingOrder]  = useState(false);
  const fileRef = useRef(null);

  // Email state
  const [emailSubject,  setEmailSubject]  = useState("");
  const [emailTo,       setEmailTo]       = useState([]);
  const [emailCc,       setEmailCc]       = useState([]);
  const [emailNote,     setEmailNote]     = useState(""); // HTML string
  const [deliveryMode,  setDeliveryMode]  = useState("now"); // "now" | "later"
  const [scheduledAt,   setScheduledAt]   = useState(""); // datetime-local value

  // Gallery access
  const [agentCanShare, setAgentCanShare] = useState(true);
  const [extraAccessEmail, setExtraAccessEmail] = useState("");

  // Category state
  const [showCatPanel,    setShowCatPanel]    = useState(false);
  const [newCatName,      setNewCatName]      = useState("");
  // categories: { catName: [mediaKey, ...] }
  const [categories,      setCategories]      = useState({});
  const [savingCats,      setSavingCats]      = useState(false);
  const [pastCatNames,    setPastCatNames]    = useState([]);

  // Bulk selection state
  const [selectedKeys,    setSelectedKeys]    = useState(new Set());
  const [bulkCatTarget,   setBulkCatTarget]   = useState("");
  const [selectMode,      setSelectMode]      = useState(false);
  const [deleting,        setDeleting]        = useState(false);

  // 3D / floor plans / files state
  const [matterportUrl,    setMatterportUrl]    = useState("");
  const [matterportHidden, setMatterportHidden] = useState(false);
  const [videoUrl,         setVideoUrl]         = useState(""); // YouTube / Vimeo URL
  const [videoUrlHidden,   setVideoUrlHidden]   = useState(false);
  const [virtualLinks,    setVirtualLinks]    = useState([]); // [{label, url}]
  const [floorPlans,      setFloorPlans]      = useState([]); // [{url, key, fileName}]
  const [attachedFiles,   setAttachedFiles]   = useState([]); // [{url, key, fileName, fileType}]
  const [mlsUrl,          setMlsUrl]          = useState("");
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

        // Gallery access settings
        if (data.gallery.agentCanShare !== undefined) setAgentCanShare(data.gallery.agentCanShare);

        // Load extras
        if (data.gallery.matterportUrl)    setMatterportUrl(data.gallery.matterportUrl);
        if (data.gallery.matterportHidden) setMatterportHidden(data.gallery.matterportHidden);
        if (data.gallery.videoUrl)         setVideoUrl(data.gallery.videoUrl);
        if (data.gallery.videoUrlHidden)   setVideoUrlHidden(data.gallery.videoUrlHidden);
        if (data.gallery.virtualLinks)     setVirtualLinks(data.gallery.virtualLinks);
        if (data.gallery.floorPlans)       setFloorPlans(data.gallery.floorPlans);
        if (data.gallery.attachedFiles)    setAttachedFiles(data.gallery.attachedFiles);
        if (data.gallery.mlsUrl)           setMlsUrl(data.gallery.mlsUrl);
      }
      setLoading(false);
    });
  }, [id]);

  // ─── Upload ──────────────────────────────────────────────────────────────
  async function uploadFiles(files) {
    setUploading(true); setProgress(0);
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
          body: JSON.stringify({ fileName: file.name, fileType: file.type, galleryId: id, fileSize: file.size }),
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
      toast(`${done} file${done !== 1 ? "s" : ""} uploaded.`);
    } else if (done > 0 && errors.length > 0) {
      toast(`${done} uploaded, ${errors.length} failed: ${errors[0]}`, "error");
    } else {
      toast(errors[0] || "Upload failed. Check R2 env vars in Vercel.", "error");
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
    toast("Order saved.");
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

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedKeys(new Set());
    setBulkCatTarget("");
  }

  async function deleteMedia(keys) {
    if (!keys || keys.length === 0) return;
    const confirmed = window.confirm(`Delete ${keys.length} photo${keys.length !== 1 ? "s" : ""}? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/galleries/${id}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keys }),
      });
      if (res.ok) {
        const keySet = new Set(keys);
        setGallery((g) => ({ ...g, media: (g.media || []).filter((m) => !keySet.has(m.key)) }));
        setSelectedKeys((prev) => { const next = new Set(prev); keys.forEach((k) => next.delete(k)); return next; });
        toast(`Deleted ${keys.length} item${keys.length !== 1 ? "s" : ""}.`);
      } else {
        const d = await res.json();
        toast(d.error || "Delete failed.", "error");
      }
    } catch {
      toast("Delete failed.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleHideMedia(key) {
    let updatedMedia;
    setGallery((g) => {
      updatedMedia = (g.media || []).map((m) =>
        m.key === key ? { ...m, hidden: !m.hidden } : m
      );
      return { ...g, media: updatedMedia };
    });
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ media: updatedMedia }),
    });
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
    toast(`Assigned ${selectedKeys.size} photos to "${bulkCatTarget}".`);
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
    toast("Categories saved.");
    setShowCatPanel(false);
  }

  // ─── Deliver ──────────────────────────────────────────────────────────────
  async function deliverGallery() {
    if (emailTo.length === 0) { toast("Add at least one recipient.", "error"); return; }
    if (deliveryMode === "later" && !scheduledAt) { toast("Pick a date and time.", "error"); return; }
    if (deliveryMode === "later" && new Date(scheduledAt) <= new Date()) {
      toast("Scheduled time must be in the future.", "error"); return;
    }
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const body  = {
      subject:      emailSubject,
      note:         emailNote,
      to:           emailTo,
      cc:           emailCc,
      agentCanShare,
      ...(deliveryMode === "later" ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    };
    const res = await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setDelivering(false); setShowDeliver(false);
    if (res.ok) {
      // Record all recipient emails as authorized viewers
      const allRecipients = [...new Set([...emailTo, ...emailCc])];
      const updatedEmails = [...new Set([...(gallery.authorizedEmails || []), ...allRecipients])];
      setGallery((g) => ({
        ...g,
        authorizedEmails: updatedEmails,
        agentCanShare,
        ...(deliveryMode === "later"
          ? { scheduledDelivery: { scheduledAt: new Date(scheduledAt), status: "pending" } }
          : { delivered: true, scheduledDelivery: null }),
      }));
      if (deliveryMode === "later") {
        toast(`Delivery scheduled for ${new Date(scheduledAt).toLocaleString()}.`);
      } else {
        toast("Gallery delivered.");
      }
    } else {
      toast("Failed — check settings and try again.", "error");
    }
  }

  async function cancelScheduledDelivery() {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast("Scheduled delivery cancelled.");
      setGallery((g) => ({ ...g, scheduledDelivery: null }));
    } else {
      toast("Failed to cancel.", "error");
    }
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

  async function saveExtras(overrides = {}) {
    setSavingExtras(true);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matterportUrl, matterportHidden, videoUrl, videoUrlHidden, virtualLinks, floorPlans, attachedFiles, mlsUrl, ...overrides }),
    });
    setSavingExtras(false);
    toast("Saved.");
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
        toast(`Floor plan upload failed: ${err.message}`, "error");
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
    if (results.length) toast(`${results.length} floor plan${results.length !== 1 ? "s" : ""} added.`);
  }

  async function uploadAttachedFile(files) {
    setUploadingFile(true);
    const results = [];
    for (const file of files) {
      try {
        const result = await uploadToR2(file, "attachments");
        results.push(result);
      } catch (err) {
        toast(`File upload failed: ${err.message}`, "error");
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
    if (results.length) toast(`${results.length} file${results.length !== 1 ? "s" : ""} attached.`);
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
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
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
        {coverImg && <img src={coverImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
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
          <div className="flex items-center gap-2">
            {gallery?.bookingId ? (
              <Link href={`/dashboard/listings/${gallery.bookingId}`}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3486cf] transition-colors font-medium">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
                Back to listing
              </Link>
            ) : (
              <Link href="/dashboard/galleries"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3486cf] transition-colors font-medium">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
                All galleries
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => {
              setShowCatPanel(true);
              if (pastCatNames.length === 0) {
                const token = await auth.currentUser?.getIdToken();
                const res = await fetch("/api/dashboard/galleries/category-names", { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) { const d = await res.json(); setPastCatNames(d.names || []); }
              }
            }} className="btn-outline text-xs px-3 py-1.5">
              📁 Categories ({catNames.length})
            </button>
            <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
              {gallery.unlocked ? "🔓 Unlocked" : "🔒 Locked"}
            </button>
            <button onClick={() => { setDeliveryMode("now"); setScheduledAt(""); setShowDeliver(true); }}
              className="btn-primary text-sm px-5 py-2">
              Deliver to Client
            </button>
          </div>
        </div>

        {/* Gallery access panel */}
        {(gallery.authorizedEmails?.length > 0 || true) && (
          <div className="mb-5 card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#0F172A]">Gallery Access</p>
              <span className="text-xs text-gray-400">No login required to view</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3 min-h-6">
              {(gallery.authorizedEmails || []).length === 0
                ? <span className="text-xs text-gray-400 italic">No recipients added yet. Deliver to add access.</span>
                : (gallery.authorizedEmails || []).map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 bg-[#3486cf]/8 text-[#3486cf] text-xs px-2.5 py-1 rounded-full">
                    {email}
                    <button
                      onClick={async () => {
                        const updated = (gallery.authorizedEmails || []).filter((e) => e !== email);
                        setGallery((g) => ({ ...g, authorizedEmails: updated }));
                        const token = await auth.currentUser.getIdToken();
                        await fetch(`/api/dashboard/galleries/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ authorizedEmails: updated }),
                        });
                      }}
                      className="hover:text-red-500 text-[#3486cf]/50 leading-none ml-0.5 text-sm">&times;</button>
                  </span>
                ))
              }
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={extraAccessEmail}
                onChange={(e) => setExtraAccessEmail(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && extraAccessEmail.includes("@")) {
                    const updated = [...new Set([...(gallery.authorizedEmails || []), extraAccessEmail.trim()])];
                    setGallery((g) => ({ ...g, authorizedEmails: updated }));
                    setExtraAccessEmail("");
                    const token = await auth.currentUser.getIdToken();
                    await fetch(`/api/dashboard/galleries/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ authorizedEmails: updated }),
                    });
                  }
                }}
                placeholder="Add email and press Enter"
                className="input-field flex-1 text-sm py-1.5"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Reshare:</span>
                <button
                  onClick={async () => {
                    const newVal = !gallery.agentCanShare;
                    setGallery((g) => ({ ...g, agentCanShare: newVal }));
                    setAgentCanShare(newVal);
                    const token = await auth.currentUser.getIdToken();
                    await fetch(`/api/dashboard/galleries/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ agentCanShare: newVal }),
                    });
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${gallery.agentCanShare !== false ? "bg-[#3486cf]" : "bg-gray-300"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${gallery.agentCanShare !== false ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scheduled delivery banner */}
        {gallery.scheduledDelivery?.status === "pending" && (
          <div className="mx-6 mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Delivery scheduled for{" "}
                {new Date(gallery.scheduledDelivery.scheduledAt?.toDate?.() || gallery.scheduledDelivery.scheduledAt)
                  .toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Email will send automatically at that time.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setDeliveryMode("later"); setShowDeliver(true); }}
                className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
              <button
                onClick={cancelScheduledDelivery}
                className="text-xs font-medium text-red-500 hover:underline">Cancel</button>
            </div>
          </div>
        )}

        {/* Upload zone */}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 mb-6 text-center cursor-pointer hover:border-[#3486cf]/40 hover:bg-gray-50 transition-colors"
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
                <div className="bg-[#3486cf] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-500">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-1">☁️</p>
              <p className="text-sm text-gray-500">Drop files or <span className="text-[#3486cf] font-medium">click to upload</span></p>
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
                      activeTab === t.id ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {!selectMode && <p className="text-xs text-gray-400 hidden md:block">Drag to reorder · first = cover</p>}
                {!selectMode && (
                  <button onClick={saveOrder} disabled={savingOrder} className="text-xs btn-outline px-3 py-1">
                    {savingOrder ? "Saving…" : "Save Order"}
                  </button>
                )}
                <button
                  onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                  className={`text-xs px-3 py-1 rounded-xl border font-medium transition-colors ${
                    selectMode
                      ? "border-[#3486cf] bg-[#3486cf] text-white"
                      : "border-gray-200 text-gray-500 hover:border-[#3486cf]/40 hover:text-[#3486cf]"
                  }`}>
                  {selectMode ? "Done" : "Select"}
                </button>
              </div>
            </div>

            {activeTab !== "videos" && (
              <>
                {/* Bulk selection toolbar */}
                {(selectMode || selectedKeys.size > 0) && (
                  <div className="flex items-center gap-3 bg-[#3486cf]/5 border border-[#3486cf]/20 rounded-xl px-3 py-2 mb-3 flex-wrap">
                    <span className="text-sm font-semibold text-[#3486cf]">
                      {selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "Tap photos to select"}
                    </span>
                    {selectedKeys.size > 0 && catNames.length > 0 && (
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
                    {selectedKeys.size > 0 && (
                      <>
                        <button onClick={selectAll} className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2 py-1 rounded hover:bg-[#3486cf]/5">
                          Select all
                        </button>
                        <button
                          onClick={() => deleteMedia(Array.from(selectedKeys))}
                          disabled={deleting}
                          className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                          {deleting ? "Deleting…" : `Delete (${selectedKeys.size})`}
                        </button>
                        <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700">
                          Deselect all
                        </button>
                      </>
                    )}
                    <button onClick={exitSelectMode} className="text-xs text-gray-400 hover:text-red-500 ml-auto">
                      Exit selection mode
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                      onDelete={() => m.key && deleteMedia([m.key])}
                      selectMode={selectMode}
                      hidden={!!m.hidden}
                      onToggleHide={() => m.key && toggleHideMedia(m.key)}
                    />
                  ))}
                </div>
              </>
            )}

            {activeTab === "videos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((v, i) => (
                  <div key={v.key || i} className={`group relative ${v.hidden ? "opacity-50" : ""}`}>
                    <video src={v.url} controls className="w-full rounded-xl" />
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs text-gray-400 truncate">{v.fileName}</p>
                        {v.hidden && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-xl bg-gray-200 text-gray-500 flex-shrink-0">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => v.key && toggleHideMedia(v.key)}
                          className="text-xs text-gray-400 hover:text-[#3486cf] px-2 py-0.5">
                          {v.hidden ? "Show" : "Hide"}
                        </button>
                        <button
                          onClick={() => v.key && deleteMedia([v.key])}
                          disabled={deleting}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5">
                          Delete
                        </button>
                      </div>
                    </div>
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
          <h2 className="font-display text-[#3486cf] text-base mb-1">Property Extras</h2>
          <p className="text-xs text-gray-400 mb-5">Add 3D tours, floor plans, and documents — all delivered alongside photos in the client gallery.</p>

          {/* 3D / Matterport */}
          <div className="card shadow-card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-[#3486cf]/8 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-[#3486cf]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">3D Tour Link</p>
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
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  3D tour will appear as an interactive embed in the client gallery.
                </p>
                <button
                  onClick={() => { const v = !matterportHidden; setMatterportHidden(v); saveExtras({ matterportHidden: v }); }}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex-shrink-0 ${
                    matterportHidden
                      ? "border-gray-300 text-gray-500 bg-gray-50 hover:bg-white"
                      : "border-gray-200 text-gray-400 hover:border-[#3486cf]/30 hover:text-[#3486cf]"
                  }`}>
                  {matterportHidden ? "Hidden from gallery" : "Hide from gallery"}
                </button>
              </div>
            )}
          </div>

          {/* Video Tour URL */}
          <div className="card shadow-card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-[#3486cf]/8 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-[#3486cf]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Video Tour</p>
                <p className="text-xs text-gray-400">YouTube or Vimeo URL — embedded in client gallery</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="input-field flex-1 text-sm"
              />
              <button onClick={saveExtras} disabled={savingExtras} className="btn-primary px-4 py-2 text-xs whitespace-nowrap">
                {savingExtras ? "Saving…" : "Save"}
              </button>
            </div>
            {videoUrl && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Video will appear in the client gallery under Property Extras.
                </p>
                <button
                  onClick={() => { const v = !videoUrlHidden; setVideoUrlHidden(v); saveExtras({ videoUrlHidden: v }); }}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex-shrink-0 ${
                    videoUrlHidden
                      ? "border-gray-300 text-gray-500 bg-gray-50 hover:bg-white"
                      : "border-gray-200 text-gray-400 hover:border-[#3486cf]/30 hover:text-[#3486cf]"
                  }`}>
                  {videoUrlHidden ? "Hidden from gallery" : "Hide from gallery"}
                </button>
              </div>
            )}
          </div>

          {/* Floor Plans */}
          <div className="card shadow-card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#3486cf]/8 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-[#3486cf]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">2D Floor Plans</p>
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
                  <div key={fp.key || i} className={`relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50 ${fp.hidden ? "opacity-50" : ""}`}>
                    {fp.fileType?.includes("pdf") ? (
                      <a href={fp.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 text-xs text-[#3486cf] font-medium hover:bg-gray-100 transition-colors">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{fp.fileName}</span>
                      </a>
                    ) : (
                      <img src={fp.url} alt={fp.fileName} className="w-full aspect-[4/3] object-cover" />
                    )}
                    {fp.hidden && (
                      <div className="absolute top-1 left-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-xl bg-gray-700/80 text-white">Hidden</span>
                      </div>
                    )}
                    {/* Hide toggle */}
                    <button
                      onClick={async () => {
                        const updated = floorPlans.map((p, idx) => idx === i ? { ...p, hidden: !p.hidden } : p);
                        setFloorPlans(updated);
                        const token = await auth.currentUser.getIdToken();
                        await fetch(`/api/dashboard/galleries/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ floorPlans: updated }),
                        });
                      }}
                      className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {fp.hidden ? "Show" : "Hide"}
                    </button>
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
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#3486cf]/8 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-[#3486cf]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Documents & Files</p>
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
                  <div key={f.key || i} className={`flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl group ${f.hidden ? "opacity-50" : ""}`}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#3486cf] hover:underline truncate flex-1">{f.fileName}</a>
                    {f.hidden && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-xl bg-gray-200 text-gray-500 flex-shrink-0">Hidden</span>}
                    <span className="text-[10px] text-gray-300 flex-shrink-0">{f.fileType?.split("/")[1]?.toUpperCase() || "FILE"}</span>
                    <button
                      onClick={async () => {
                        const updated = attachedFiles.map((af, idx) => idx === i ? { ...af, hidden: !af.hidden } : af);
                        setAttachedFiles(updated);
                        const token = await auth.currentUser.getIdToken();
                        await fetch(`/api/dashboard/galleries/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ attachedFiles: updated }),
                        });
                      }}
                      className="text-[10px] text-gray-400 hover:text-[#3486cf] opacity-0 group-hover:opacity-100 transition-opacity px-1">
                      {f.hidden ? "Show" : "Hide"}
                    </button>
                    <button onClick={() => setAttachedFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none ml-1">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Listing Links (Agent Hub) ─────────────────────────────────── */}
          <div className="card shadow-card mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-[#3486cf]/8 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-[#3486cf]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Listing Links</p>
                <p className="text-xs text-gray-400">Shown to agents in the gallery — quick links to the live listing and search portals.</p>
              </div>
            </div>

            {/* Auto-generated search links (read-only preview) */}
            {gallery?.bookingAddress && (
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { label: "Search Zillow", url: `https://www.zillow.com/homes/${encodeURIComponent(gallery.bookingAddress)}_rb/` },
                  { label: "Search Redfin", url: `https://www.redfin.com/query/${encodeURIComponent(gallery.bookingAddress).replace(/%20/g, "+")}` },
                  { label: "Search Realtor.com", url: `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(gallery.bookingAddress).replace(/%20/g, "-")}` },
                ].map((l) => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded-full hover:bg-[#3486cf]/5 transition-colors font-medium">
                    {l.label} →
                  </a>
                ))}
                <span className="text-xs text-gray-400 self-center">auto-generated from address</span>
              </div>
            )}

            {/* Manual MLS link */}
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="label-field text-xs">MLS / Portal Link (optional)</label>
                <input type="url" value={mlsUrl} onChange={(e) => setMlsUrl(e.target.value)}
                  placeholder="https://matrix.mlslistings.com/... or any direct listing URL"
                  className="input-field w-full text-sm" />
              </div>
              <button onClick={() => saveExtras()} disabled={savingExtras}
                className="btn-primary px-4 py-2 text-xs whitespace-nowrap mt-4">
                {savingExtras ? "Saving…" : "Save"}
              </button>
            </div>
            {mlsUrl && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                MLS link will appear as a button in the agent gallery.
              </p>
            )}
          </div>

        </div>
      </div>

      {/* Category panel */}
      {showCatPanel && (
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={() => setShowCatPanel(false)} />
          <div className="modal-card relative w-full max-w-md">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="font-semibold text-[#0F172A] text-base">Manage Categories</h2>
              <button onClick={() => setShowCatPanel(false)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Create folders to organize photos. Assign photos to categories from the gallery grid.</p>
              <div className="flex gap-2">
                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="Category name (e.g. Exterior)" className="input-field flex-1" />
                <button onClick={addCategory} className="btn-primary px-4 py-2.5 text-sm whitespace-nowrap">Add</button>
              </div>
              {/* Previous folder name suggestions */}
              {pastCatNames.filter((n) => !categories[n]).length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Previous folders used:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pastCatNames.filter((n) => !categories[n]).map((n) => (
                      <button key={n} type="button"
                        onClick={() => { setNewCatName(""); setCategories((prev) => ({ ...prev, [n]: [] })); }}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-full hover:border-[#3486cf]/40 hover:bg-[#3486cf]/5 text-gray-600 transition-colors">
                        + {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {catNames.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No categories yet.</p>
              ) : (
                <div className="space-y-1">
                  {catNames.map((cat) => (
                    <div key={cat} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{cat}</p>
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
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={() => setShowDeliver(false)} />
          <div className="modal-card relative w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="font-semibold text-[#0F172A] text-base">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
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

              {/* Gallery access settings */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gallery Access</p>
                <p className="text-xs text-gray-400">Recipients get view access via the link — no account needed. Emails listed here are recorded for your reference.</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Agents can reshare this gallery</p>
                    <p className="text-xs text-gray-400">If on, the gallery page shows a copy-link button to the viewer.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAgentCanShare((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${agentCanShare ? "bg-[#3486cf]" : "bg-gray-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${agentCanShare ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Send time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">When to Send</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {[["now", "Send Now"], ["later", "Schedule"]].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setDeliveryMode(val)}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        deliveryMode === val
                          ? "bg-[#3486cf] text-white"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {deliveryMode === "later" && (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      min={(() => { const d = new Date(); d.setMinutes(d.getMinutes() + 15); return d.toISOString().slice(0,16); })()}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="input-field w-full"
                    />
                    <p className="text-xs text-gray-400 mt-1">Email delivers automatically at this time. You can cancel it before then.</p>
                  </div>
                )}
              </div>

              {/* Email preview */}
              {deliveryMode === "now" && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-2">
                  <p className="font-medium text-xs text-gray-400 uppercase tracking-wide mb-3">Email preview</p>
                  <p>Hi <strong>{gallery.clientName || "there"}</strong>,</p>
                  {emailNote && (
                    <div className="text-gray-600" dangerouslySetInnerHTML={{ __html: emailNote }} />
                  )}
                  <p>Your media for <strong>{gallery.bookingAddress}</strong> is ready to view and download.</p>
                  {galleryUrl ? (
                    <a href={galleryUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-block text-[#3486cf] font-semibold underline hover:text-[#3486cf]-light">
                      [ View Gallery → ]
                    </a>
                  ) : (
                    <p className="text-[#3486cf] font-semibold">[ View Gallery ]</p>
                  )}
                  <p className="text-gray-400 text-xs mt-3">— {gallery.tenantName || "Your photographer"}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={deliverGallery}
                disabled={delivering || emailTo.length === 0 || (deliveryMode === "later" && !scheduledAt)}
                className="btn-primary px-6 py-2 text-sm">
                {delivering
                  ? (deliveryMode === "later" ? "Scheduling…" : "Sending…")
                  : deliveryMode === "later"
                    ? "Schedule Delivery →"
                    : `Deliver to ${emailTo.length + emailCc.length} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
