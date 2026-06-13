"use client";

// Settings → Integrations → Aryeo Import.
// Lets a studio migrating from Aryeo connect their API key, test it, and import
// products → KyoriaOS services. Everything imports as inactive drafts and is
// reviewed (with duplicate handling) before it's written.

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";

const ACTION_LABELS = { new: "Import as new", update: "Update existing", skip: "Skip" };

export default function AryeoImport({ onImported }) {
  const [status,   setStatus]   = useState(null);   // { connected, lastVerifiedAt }
  const [apiKey,   setApiKey]    = useState("");
  const [saving,   setSaving]    = useState(false);
  const [testing,  setTesting]   = useState(false);
  const [msg,      setMsg]       = useState(null);   // { text, type }
  const [preview,  setPreview]   = useState(null);   // { items, categories, counts }
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results,  setResults]   = useState(null);

  const token = () => auth.currentUser?.getIdToken();
  const note = (text, type = "success") => { setMsg({ text, type }); setTimeout(() => setMsg(null), 5000); };

  const loadStatus = useCallback(async () => {
    try {
      const t = await token();
      const res = await fetch("/api/integrations/aryeo/status", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function saveKey() {
    if (!apiKey.trim()) return;
    setSaving(true); setMsg(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/aryeo/save-key", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const d = await res.json();
      if (res.ok) { note("Aryeo connected."); setApiKey(""); loadStatus(); }
      else note(d.error || "Couldn't save the key.", "error");
    } catch { note("Something went wrong.", "error"); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true); setMsg(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/aryeo/test", { headers: { Authorization: `Bearer ${t}` } });
      const d = await res.json();
      note(res.ok ? "Connection works ✓" : (d.error || "Connection failed."), res.ok ? "success" : "error");
    } catch { note("Connection failed.", "error"); }
    finally { setTesting(false); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Aryeo? Your imported services stay; only the API key is removed.")) return;
    try {
      const t = await token();
      await fetch("/api/integrations/aryeo/status", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
      setStatus({ connected: false }); note("Aryeo disconnected.");
    } catch { note("Something went wrong.", "error"); }
  }

  async function startImport() {
    setLoadingPreview(true); setMsg(null); setResults(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/aryeo/import", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ mode: "preview" }),
      });
      const d = await res.json();
      if (res.ok && d.preview) setPreview(d);
      else note(d.error || "Couldn't load products from Aryeo.", "error");
    } catch { note("Couldn't load products from Aryeo.", "error"); }
    finally { setLoadingPreview(false); }
  }

  function setItemField(key, field, value) {
    setPreview((p) => ({ ...p, items: p.items.map((it) => it.key === key ? { ...it, [field]: value } : it) }));
  }
  function setAll(action) {
    setPreview((p) => ({ ...p, items: p.items.map((it) => ({ ...it, action })) }));
  }

  async function confirmImport() {
    setImporting(true); setMsg(null);
    try {
      const t = await token();
      const res = await fetch("/api/integrations/aryeo/import", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ mode: "commit", items: preview.items }),
      });
      const d = await res.json();
      if (res.ok) { setResults(d); setPreview(null); if (onImported) onImported(d); }
      else note(d.error || "Import failed.", "error");
    } catch { note("Import failed.", "error"); }
    finally { setImporting(false); }
  }

  const toImport = preview ? preview.items.filter((i) => i.action !== "skip").length : 0;

  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Aryeo Import</h3>
          <p className="text-xs text-gray-500 mt-0.5">Migrating from Aryeo? Import your products, pricing, and durations as draft services.</p>
        </div>
        {status?.connected && (
          <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">Connected</span>
        )}
      </div>

      {msg && (
        <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${msg.type === "error" ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Connect / key entry */}
      {!status?.connected ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="Aryeo API key" className="input-field flex-1 text-sm" autoComplete="off" />
          <button onClick={saveKey} disabled={saving || !apiKey.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
            {saving ? "Saving…" : "Save & Connect"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={testConnection} disabled={testing} className="btn-outline text-sm px-4 py-2 disabled:opacity-50">
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button onClick={startImport} disabled={loadingPreview} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
            {loadingPreview ? "Loading…" : "Import Products"}
          </button>
          <button onClick={disconnect} className="text-xs text-gray-400 hover:text-red-500 px-2 py-2">Disconnect</button>
          {status.lastVerifiedAt && (
            <span className="text-[11px] text-gray-400 ml-auto">Connected {new Date(status.lastVerifiedAt).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Results summary */}
      {results && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["Imported", results.imported, "text-green-700 bg-green-50 border-green-200"],
            ["Updated", results.updated, "text-blue-700 bg-blue-50 border-blue-200"],
            ["Skipped", results.skipped, "text-gray-600 bg-gray-50 border-gray-200"],
            ["Errors", results.errors, "text-red-600 bg-red-50 border-red-200"],
          ].map(([label, n, cls]) => (
            <div key={label} className={`border rounded-lg px-3 py-2 text-center ${cls}`}>
              <p className="text-lg font-bold leading-none">{n}</p>
              <p className="text-[11px] mt-1">{label}</p>
            </div>
          ))}
          <p className="col-span-full text-xs text-gray-500 mt-1">
            Imported services are saved as <strong>inactive drafts</strong> in Products → Services. Review and toggle Active to publish.
          </p>
        </div>
      )}

      {/* Review modal */}
      {preview && (
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={() => !importing && setPreview(null)} />
          <div className="modal-card relative w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <h2 className="font-semibold text-[#0F172A] text-base">Review Aryeo import</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {preview.counts.products} products → {preview.counts.services} services
                  {preview.counts.duplicates > 0 && ` · ${preview.counts.duplicates} possible duplicate${preview.counts.duplicates !== 1 ? "s" : ""}`}
                  {preview.categories.length > 0 && ` · ${preview.categories.length} categories`}
                </p>
              </div>
              <button onClick={() => !importing && setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-2 flex items-center gap-2 text-xs border-b border-gray-100">
              <span className="text-gray-400">Set all:</span>
              <button onClick={() => setAll("new")} className="text-[#3486cf] hover:underline">Import all</button>
              <button onClick={() => setAll("skip")} className="text-gray-500 hover:underline">Skip all</button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {preview.items.map((it) => (
                <div key={it.key} className="flex items-center gap-3 px-6 py-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {it.imageUrl
                      ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm opacity-20">🏠</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0F172A] truncate">{it.name}</span>
                      {it.duplicate && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          Possible duplicate
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {(() => {
                        const tv = it.priceTiers ? Object.values(it.priceTiers).filter((v) => v > 0) : [];
                        return tv.length ? `From $${Math.min(...tv).toLocaleString()} · ${tv.length} tiers` : `$${Number(it.price || 0).toLocaleString()}`;
                      })()}
                      {it.duration ? ` · ${it.duration} min` : ""}{it.category ? ` · ${it.category}` : ""}
                    </p>
                  </div>
                  <select value={it.type} onChange={(e) => setItemField(it.key, "type", e.target.value)}
                    disabled={it.action === "skip"}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-shrink-0 disabled:opacity-40"
                    title="Where this lands in Products">
                    <option value="services">Service</option>
                    <option value="packages">Package</option>
                    <option value="addons">Add-on</option>
                  </select>
                  <select value={it.action} onChange={(e) => setItemField(it.key, "action", e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-shrink-0">
                    <option value="new">{ACTION_LABELS.new}</option>
                    {it.duplicate && <option value="update">{ACTION_LABELS.update}</option>}
                    <option value="skip">{ACTION_LABELS.skip}</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Diagnostic — helps map fields exactly if images/prices look off */}
            {preview.sampleProduct && (
              <details className="px-6 py-2 border-t border-gray-100">
                <summary className="text-[11px] text-gray-400 cursor-pointer">Raw data (for support)</summary>
                <div className="mt-2">
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(JSON.stringify({ product: preview.sampleProduct, category: preview.sampleCategory }, null, 2)); note("Copied — paste it to support."); } catch {} }}
                    className="text-[11px] text-[#3486cf] underline mb-1">Copy raw sample</button>
                  <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify({ product: preview.sampleProduct, category: preview.sampleCategory }, null, 2).slice(0, 4000)}
                  </pre>
                </div>
              </details>
            )}

            <div className="px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-xs text-gray-500">{toImport} of {preview.items.length} will be imported · all as inactive drafts</p>
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)} disabled={importing} className="btn-outline text-sm px-4 py-2">Cancel</button>
                <button onClick={confirmImport} disabled={importing || toImport === 0} className="btn-primary text-sm px-5 py-2 disabled:opacity-40">
                  {importing ? "Importing…" : `Import ${toImport}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
