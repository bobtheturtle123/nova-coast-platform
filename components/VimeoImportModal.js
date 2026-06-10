"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

// Browse the tenant's Vimeo videos and import selected ones into a gallery.
export default function VimeoImportModal({ galleryId, onClose, onImported }) {
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState({}); // id -> item
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const token = useCallback(() => auth.currentUser?.getIdToken(), []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/vimeo/list", { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      if (res.status === 409 || d.reconnect) { setError("Vimeo needs to be reconnected in Settings → Integrations."); return; }
      if (!res.ok) { setError(d.error || "Could not load your Vimeo videos."); return; }
      setVideos(d.videos || []);
    } catch { setError("Could not load your Vimeo videos."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function toggle(v) {
    if (!v.downloadable) return;
    setSelected((s) => {
      const n = { ...s };
      if (n[v.id]) delete n[v.id];
      else n[v.id] = { name: v.name, downloadLink: v.downloadLink, size: v.size };
      return n;
    });
  }
  const selectedList = Object.values(selected);

  async function doImport() {
    if (selectedList.length === 0) return;
    setImporting(true); setError(null); setResult(null);
    try {
      const t = await token();
      const res = await fetch(`/api/dashboard/galleries/${galleryId}/media/import-vimeo`, {
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

  const dur = (s) => { if (!s) return ""; const m = Math.floor(s / 60), ss = s % 60; return `${m}:${String(ss).padStart(2, "0")}`; };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Import from Vimeo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-[240px]">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#1AB7EA]/30 border-t-[#1AB7EA] rounded-full animate-spin" /></div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600 px-6">{error}</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No videos found on this Vimeo account.</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {videos.map((v) => {
                const sel = !!selected[v.id];
                return (
                  <li key={v.id}>
                    <button onClick={() => toggle(v)} disabled={!v.downloadable}
                      className={`w-full text-left rounded-xl border overflow-hidden transition-colors ${sel ? "border-[#1AB7EA] ring-1 ring-[#1AB7EA]/30" : "border-gray-200 hover:border-gray-300"} ${!v.downloadable ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <div className="relative aspect-video bg-gray-900">
                        {v.thumb && <img src={v.thumb} alt="" className="w-full h-full object-cover" />}
                        {v.duration > 0 && <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">{dur(v.duration)}</span>}
                        {sel && <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#1AB7EA] text-white text-xs flex items-center justify-center">✓</span>}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-gray-800 truncate">{v.name}</p>
                        {!v.downloadable && <p className="text-[10px] text-amber-600">Download not available</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {videos.some((v) => !v.downloadable) && !loading && !error && (
          <p className="px-5 py-1.5 text-[11px] text-gray-400">
            Videos marked "Download not available" require a Vimeo plan with downloads enabled.
          </p>
        )}

        {result && (
          <div className="px-5 py-2 text-xs border-t border-gray-50">
            <span className="text-emerald-600 font-medium">{result.importedCount} imported.</span>{" "}
            {result.skippedCount > 0 && <span className="text-gray-500">{result.skippedCount} skipped ({[...new Set(result.skipped.map((s) => s.reason))].join("; ")}).</span>}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{selectedList.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
            <button onClick={doImport} disabled={importing || selectedList.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1AB7EA] hover:opacity-90 disabled:opacity-50">
              {importing ? "Importing…" : `Import selected${selectedList.length ? ` (${selectedList.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
