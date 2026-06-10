"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

// Browse the tenant's completed CubiCasa floor plans and import a selected one
// into a gallery. All CubiCasa calls go through KyoriaOS API routes. If the
// account's API doesn't expose a listable set of completed plans, we say so
// honestly instead of faking results.
export default function CubiCasaImportModal({ galleryId, accountEmail, onClose, onImported }) {
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null); // { url, label, address }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const token = useCallback(() => auth.currentUser?.getIdToken(), []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/cubicasa/floorplans", { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      if (res.status === 409) { setError("CubiCasa needs to be reconnected in Settings → Integrations."); return; }
      if (!res.ok) { setError(d.error || "Could not load CubiCasa floor plans."); return; }
      setSupported(d.supported !== false);
      setMessage(d.message || "");
      setItems(d.items || []);
    } catch { setError("Could not load CubiCasa floor plans."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function doImport() {
    if (!selected) return;
    setImporting(true); setError(null); setResult(null);
    try {
      const t = await token();
      const res = await fetch(`/api/dashboard/galleries/${galleryId}/media/import-cubicasa`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ files: [selected] }),
      });
      const d = await res.json();
      if (!res.ok && !d.imported) { setError(d.error || "Import failed."); return; }
      setResult(d);
      if (d.importedCount > 0) onImported?.(d.imported);
    } catch { setError("Import failed."); }
    finally { setImporting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Import from CubiCasa</h2>
            {accountEmail && <p className="text-xs text-gray-400">{accountEmail}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-[220px]">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" /></div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600 px-6">{error}</div>
          ) : !supported ? (
            <div className="text-center py-12 px-6">
              <p className="text-3xl mb-3">🗂️</p>
              <p className="text-sm text-gray-600 max-w-md mx-auto">{message || "Your CubiCasa account doesn't support listing completed floor plans through the API yet."}</p>
              <p className="text-xs text-gray-400 mt-3">You can still upload floor plan files directly, or import them from Dropbox.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">No completed CubiCasa floor plans found for this account.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map((it) => (
                <li key={it.id} className="py-2">
                  <div className="px-2">
                    <p className="text-sm font-medium text-gray-800">{it.address || "Floor plan"}</p>
                    <p className="text-[11px] text-gray-400">
                      {it.status ? `${it.status} · ` : ""}{it.createdAt ? new Date(it.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="mt-1 space-y-1">
                    {it.files.map((f, i) => {
                      const isSel = selected?.url === f.url;
                      return (
                        <label key={i} className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer ${isSel ? "bg-[#3486cf]/10" : "hover:bg-gray-50"}`}>
                          <input type="radio" name="cc-file" checked={isSel}
                            onChange={() => setSelected({ url: f.url, label: f.label, address: it.address })}
                            className="accent-[#3486cf]" />
                          <span>📄</span>
                          <span className="text-sm text-gray-700 flex-1">{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {result && (
          <div className="px-5 py-2 text-xs border-t border-gray-50">
            <span className="text-emerald-600 font-medium">{result.importedCount} imported.</span>{" "}
            {result.skippedCount > 0 && <span className="text-gray-500">{result.skippedCount} skipped.</span>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
          {supported && items.length > 0 && (
            <button onClick={doImport} disabled={importing || !selected}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-50">
              {importing ? "Importing…" : "Import floor plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
