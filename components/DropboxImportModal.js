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
  const [result, setResult]   = useState(null);

  const token = useCallback(() => auth.currentUser?.getIdToken(), []);

  const browse = useCallback(async (p) => {
    setLoading(true); setError(null);
    try {
      const t = await token();
      const res = await fetch(`/api/integrations/dropbox/list?path=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = await res.json();
      if (res.status === 409 || d.reconnect) { setError("Dropbox needs to be reconnected in Settings → Integrations."); return; }
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

  const selectedList = Object.values(selected);

  async function doImport() {
    if (selectedList.length === 0) return;
    setImporting(true); setError(null); setResult(null);
    try {
      const t = await token();
      const res = await fetch(`/api/dashboard/galleries/${galleryId}/media/import-dropbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ items: selectedList }),
      });
      const d = await res.json();
      if (!res.ok && !d.imported) { setError(d.error || "Import failed."); return; }
      setResult(d);
      if (d.importedCount > 0) onImported?.(d.imported);
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
          ) : error ? (
            <div className="text-center py-14 text-sm text-red-600 px-6">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">This folder is empty.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {entries.map((e) => (
                <li key={e.path}>
                  {e.type === "folder" ? (
                    <button onClick={() => browse(e.path)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left rounded-lg">
                      <span>{icon(e)}</span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{e.name}</span>
                      <span className="text-gray-300">›</span>
                    </button>
                  ) : (
                    <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer rounded-lg">
                      <input type="checkbox" checked={!!selected[e.path]} onChange={() => toggle(e)}
                        className="accent-[#3486cf]" />
                      <span>{icon(e)}</span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{e.name}</span>
                      <span className="text-xs text-gray-400">{fmtSize(e.size)}</span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
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
              {importing ? "Importing…" : `Import selected${selectedList.length ? ` (${selectedList.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
