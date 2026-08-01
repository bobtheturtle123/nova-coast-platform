"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

// Browse the tenant's connected Dropbox and import selected files into a gallery.
// All Dropbox calls go through KyoriaOS API routes; tokens never reach the client.
export default function DropboxImportModal({ galleryId, onClose, onImported }) {
  const [path, setPath]       = useState("");        // current Dropbox folder
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState({});      // path -> {name,size,path}
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } during a batched import
  const [result, setResult]   = useState(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [connecting, setConnecting]     = useState(false);
  const [authToken, setAuthToken]       = useState("");   // for <img> thumbnail URLs
  const [lastIdx, setLastIdx]           = useState(null); // anchor for shift-click ranges

  const token = useCallback(() => auth.currentUser?.getIdToken(), []);
  useEffect(() => { token().then((t) => setAuthToken(t || "")); }, [token]);

  const isImage = (name) => /\.(jpg|jpeg|png|webp|tiff?|heic)$/i.test(name || "");
  const thumbUrl = (p) => authToken
    ? `/api/integrations/dropbox/thumbnail?path=${encodeURIComponent(p)}&token=${encodeURIComponent(authToken)}`
    : null;

  // Connect Dropbox right here via an OAuth popup, then auto-retry the browse —
  // no need to leave the page for Settings.
  const connectDropbox = useCallback(async () => {
    setConnecting(true); setError(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/dropbox/connect?mode=popup", { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      if (!d.url) { setError(d.error || "Could not start the Dropbox connection."); setConnecting(false); return; }
      const popup = window.open(d.url, "dropbox_connect", "width=620,height=740");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          setNeedsConnect(false);
          browse("");
        }
      }, 800);
    } catch {
      setError("Could not start the Dropbox connection.");
      setConnecting(false);
    }
  }, [token]);

  const browse = useCallback(async (p) => {
    setLoading(true); setError(null);
    try {
      const t = await token();
      const res = await fetch(`/api/integrations/dropbox/list?path=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = await res.json();
      if (res.status === 409 || d.reconnect) { setNeedsConnect(true); return; }
      if (!res.ok) { setError(d.error || "Could not load Dropbox."); return; }
      setEntries(d.entries || []);
      setPath(d.path || p);
    } catch { setError("Could not load Dropbox."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { browse(""); }, [browse]);

  const crumbs = path ? path.split("/").filter(Boolean) : [];
  const goCrumb = (i) => browse(i < 0 ? "" : "/" + crumbs.slice(0, i + 1).join("/"));

  function toggle(file) {
    setSelected((s) => {
      const n = { ...s };
      if (n[file.path]) delete n[file.path];
      else n[file.path] = { path: file.path, name: file.name, size: file.size };
      return n;
    });
  }

  // Click a file to toggle it; Shift-click to select the whole range since the
  // last click (files only) — the fast way to grab a whole shoot at once.
  function clickFile(file, idx, shiftKey) {
    if (shiftKey && lastIdx !== null) {
      const [a, b] = [lastIdx, idx].sort((x, y) => x - y);
      setSelected((s) => {
        const n = { ...s };
        for (let i = a; i <= b; i++) {
          const it = entries[i];
          if (it && it.type === "file") n[it.path] = { path: it.path, name: it.name, size: it.size };
        }
        return n;
      });
    } else {
      toggle(file);
    }
    setLastIdx(idx);
  }

  const fileEntries = entries.filter((e) => e.type === "file");
  const allFilesSelected = fileEntries.length > 0 && fileEntries.every((f) => selected[f.path]);
  function selectAllFiles() {
    setSelected((s) => {
      const n = { ...s };
      if (allFilesSelected) fileEntries.forEach((f) => delete n[f.path]);
      else fileEntries.forEach((f) => { n[f.path] = { path: f.path, name: f.name, size: f.size }; });
      return n;
    });
  }

  const selectedList = Object.values(selected);

  async function doImport() {
    if (selectedList.length === 0) return;
    setImporting(true); setError(null); setResult(null); setProgress(null);
    try {
      const t = await token();
      // Import in small batches so a large selection can't exceed the serverless
      // time/memory limit (which previously returned a non-JSON 504 → generic
      // "Import failed"). Results are accumulated across batches.
      const BATCH = 12;
      const agg = { imported: [], skipped: [], importedCount: 0, skippedCount: 0, needReconnect: false };
      for (let i = 0; i < selectedList.length; i += BATCH) {
        const chunk = selectedList.slice(i, i + BATCH);
        setProgress({ done: i, total: selectedList.length });
        let d = null;
        try {
          const res = await fetch(`/api/dashboard/galleries/${galleryId}/media/import-dropbox`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
            body: JSON.stringify({ items: chunk }),
          });
          d = await res.json().catch(() => null);
          // Auth/permission failure on the first batch is fatal — surface it.
          if (!d && i === 0 && !res.ok) { setError(`Import failed (server error ${res.status}).`); return; }
        } catch { /* network — treat this batch as skipped, keep going */ }
        if (!d) {
          chunk.forEach((it) => agg.skipped.push({ name: it.name, reason: "Server error on this batch" }));
          agg.skippedCount += chunk.length;
          continue;
        }
        agg.imported.push(...(d.imported || []));
        agg.skipped.push(...(d.skipped || []));
        agg.importedCount += d.importedCount || 0;
        agg.skippedCount  += d.skippedCount || 0;
        if (d.needReconnect) { agg.needReconnect = true; break; }
      }
      setProgress(null);
      setResult(agg);
      if (agg.importedCount > 0) onImported?.(agg.imported);
      setSelected({});
    } catch { setError("Import failed."); }
    finally { setImporting(false); }
  }

  const icon = (e) => e.type === "folder" ? "📁"
    : /\.(jpg|jpeg|png|webp|tiff?|heic)$/i.test(e.name) ? "🖼️"
    : /\.(mp4|mov|webm|m4v)$/i.test(e.name) ? "🎬"
    : /\.pdf$/i.test(e.name) ? "📄" : "📦";

  const fmtSize = (n) => !n ? "" : n > 1e9 ? `${(n/1e9).toFixed(1)} GB` : n > 1e6 ? `${(n/1e6).toFixed(1)} MB` : `${Math.max(1,Math.round(n/1e3))} KB`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Import from Dropbox</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Breadcrumbs */}
        <div className="px-5 py-2 border-b border-gray-50 flex items-center gap-1 text-xs text-gray-500 flex-wrap">
          <button onClick={() => goCrumb(-1)} className="hover:text-[#3486cf]">Dropbox</button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-gray-300">/</span>
              <button onClick={() => goCrumb(i)} className="hover:text-[#3486cf]">{c}</button>
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[240px]">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" /></div>
          ) : needsConnect ? (
            <div className="text-center py-14 px-6">
              <p className="text-3xl mb-3">🔗</p>
              <p className="text-sm font-semibold text-gray-900 mb-1">Connect your Dropbox</p>
              <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">Sign in to Dropbox once so KyoriaOS can import your files. A window will pop up — finish there and this list loads automatically.</p>
              <button onClick={connectDropbox} disabled={connecting}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">
                {connecting ? "Waiting for Dropbox…" : "Connect Dropbox"}
              </button>
            </div>
          ) : error ? (
            <div className="text-center py-14 text-sm text-red-600 px-6">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">This folder is empty.</div>
          ) : (
            <>
              {/* Bulk select — grab a whole shoot without clicking each file. */}
              {fileEntries.length > 0 && (
                <div className="flex items-center justify-between px-3 pb-1.5">
                  <button onClick={selectAllFiles} className="text-xs font-semibold text-[#3486cf] hover:underline">
                    {allFilesSelected ? "Deselect all" : `Select all ${fileEntries.length} files`}
                  </button>
                  <span className="text-[11px] text-gray-400">Tip: Shift-click to select a range</span>
                </div>
              )}
              <ul className="divide-y divide-gray-50">
                {entries.map((e, idx) => (
                  <li key={e.path}>
                    {e.type === "folder" ? (
                      <button onClick={() => browse(e.path)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left rounded-lg">
                        <span className="w-9 text-center">{icon(e)}</span>
                        <span className="text-sm text-gray-800 flex-1 truncate">{e.name}</span>
                        <span className="text-gray-300">›</span>
                      </button>
                    ) : (
                      <div onClick={(ev) => clickFile(e, idx, ev.shiftKey)}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg select-none ${selected[e.path] ? "bg-[#3486cf]/10" : "hover:bg-gray-50"}`}>
                        <input type="checkbox" readOnly checked={!!selected[e.path]}
                          className="accent-[#3486cf] pointer-events-none" />
                        {isImage(e.name) && thumbUrl(e.path) ? (
                          <img src={thumbUrl(e.path)} alt="" loading="lazy"
                            className="w-9 h-9 rounded object-cover bg-gray-100 flex-shrink-0"
                            onError={(ev) => { ev.currentTarget.style.visibility = "hidden"; }} />
                        ) : (
                          <span className="w-9 text-center">{icon(e)}</span>
                        )}
                        <span className="text-sm text-gray-800 flex-1 truncate">{e.name}</span>
                        <span className="text-xs text-gray-400">{fmtSize(e.size)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Result summary */}
        {result && (
          <div className="px-5 py-2 text-xs border-t border-gray-50">
            <span className="text-emerald-600 font-medium">{result.importedCount} imported.</span>{" "}
            {result.skippedCount > 0 && (
              <span className="text-gray-500">
                {result.skippedCount} skipped ({[...new Set(result.skipped.map((s) => s.reason))].join("; ")}).
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{selectedList.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
            <button onClick={doImport} disabled={importing || selectedList.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-50">
              {importing
                ? (progress ? `Importing ${progress.done}/${progress.total}…` : "Importing…")
                : `Import selected${selectedList.length ? ` (${selectedList.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
