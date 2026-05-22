"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";
import { ZONE_COLORS } from "@/lib/zoneColors";
import { avatarColor, initials } from "@/lib/avatar";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ── ZoneModal (mirrors service-areas, plus firstTime pro-tip) ─────────────────

function ZoneModal({ zone, teamMembers, onSave, onDelete, onClose, firstTime }) {
  const [form, setForm] = useState({
    name:       zone?.name       || "",
    type:       zone?.type       || "include",
    color:      zone?.color      || ZONE_COLORS[0],
    assignedTo: zone?.assignedTo || [],
    notes:      zone?.notes      || "",
  });
  const [saving, setSaving] = useState(false);

  function toggleMember(id) {
    setForm(f => ({
      ...f,
      assignedTo: f.assignedTo.includes(id)
        ? f.assignedTo.filter(x => x !== id)
        : [...f.assignedTo, id],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const labelStyle = { fontSize: 11.5, fontWeight: 600, color: "#0F172A", display: "block", marginBottom: 5 };
  const inputStyle = {
    width: "100%", height: 38, padding: "0 12px", fontSize: 13,
    border: "1px solid #E9ECF0", borderRadius: 9, outline: "none",
    background: "#fff", color: "#0F172A", fontFamily: "inherit",
  };

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative" style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.24), 0 0 0 1px rgba(0,0,0,0.05)",
      }}>
        {/* Pro-tip banner (first zone only) */}
        {firstTime && (
          <div style={{ padding: "10px 20px", background: "#EEF4FA", borderBottom: "1px solid #DAE6F4", borderRadius: "18px 18px 0 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, color: "#3486cf", flexShrink: 0 }}>💡</span>
            <p style={{ margin: 0, fontSize: 13, color: "#1E5A8A", lineHeight: 1.5 }}>
              <strong>Pro tip:</strong> Assign at least one photographer to this zone so bookings here get auto-routed.
            </p>
          </div>
        )}

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E9ECF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{zone ? "Edit Zone" : "New Zone"}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#9CA3AF", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Zone Name</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Los Angeles, Miami Beach"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "#3486cf"; e.target.style.boxShadow = "0 0 0 3px rgba(52,134,207,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#E9ECF0"; e.target.style.boxShadow = "none"; }} />
          </div>

          <div>
            <label style={labelStyle}>Zone Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { value: "include", label: "Service Area",  desc: "You work in this zone" },
                { value: "exclude", label: "Excluded Area", desc: "You don't work here" },
              ].map(opt => {
                const on = form.type === opt.value;
                const isExclude = opt.value === "exclude";
                return (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                    style={{ padding: 12, borderRadius: 9, textAlign: "left", cursor: "pointer",
                      border: on ? `1.5px solid ${isExclude ? "#DC2626" : "#3486cf"}` : "1.5px solid #E9ECF0",
                      background: on ? (isExclude ? "#FEE2E2" : "#EEF4FA") : "#fff", transition: "all 0.12s" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: on ? (isExclude ? "#DC2626" : "#0F172A") : "#6B7280" }}>{opt.label}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Zone Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ZONE_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                    transform: form.color === c ? "scale(1.1)" : "scale(1)",
                    boxShadow: form.color === c ? "0 0 0 2px #fff, 0 0 0 4px #9CA3AF" : "none",
                    transition: "all 0.12s" }} />
              ))}
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label style={labelStyle}>Assign Photographers</label>
              <p style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 8 }}>Only these photographers will be scheduled in this zone</p>
              <div style={{ border: "1px solid #E9ECF0", borderRadius: 9, padding: "4px 0", maxHeight: 160, overflowY: "auto" }}>
                {teamMembers.map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: form.assignedTo.includes(m.id) ? "none" : "1.5px solid #D1D5DB",
                      background: form.assignedTo.includes(m.id) ? "#3486cf" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {form.assignedTo.includes(m.id) && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5 9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input type="checkbox" checked={form.assignedTo.includes(m.id)} onChange={() => toggleMember(m.id)} style={{ display: "none" }} />
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.color || "#6B7280", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: "#0F172A", flex: 1 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{m.role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Avoid during rush hour"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "#3486cf"; e.target.style.boxShadow = "0 0 0 3px rgba(52,134,207,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#E9ECF0"; e.target.style.boxShadow = "none"; }} />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #E9ECF0", background: "#FAFAFA", borderRadius: "0 0 18px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {zone?.id && (
              <button onClick={onDelete}
                style={{ height: 34, padding: "0 14px", border: "1px solid transparent", background: "transparent", color: "#DC2626", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                Delete zone
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose}
              style={{ height: 34, padding: "0 14px", border: "1px solid #E9ECF0", background: "#fff", color: "#475569", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ height: 34, padding: "0 18px", border: "1px solid #3486cf", background: "#3486cf", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving || !form.name.trim() ? "not-allowed" : "pointer", opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save Zone"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AddressSearch ─────────────────────────────────────────────────────────────

function AddressSearch({ mapRef, mapReady, onFirstSelect }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [searching, setSearching] = useState(false);
  const [showTip,   setShowTip]   = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);
  const wrapRef     = useRef(null);
  const hasSelected = useRef(false);

  // ⌘K shortcut
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // First-time tooltip after 1.5s if no defaultCoords
  useEffect(() => {
    const t = setTimeout(() => { if (!hasSelected.current) setShowTip(true); }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setShowTip(false);
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const center = mapRef.current?.getCenter();
        const proximity = center ? `&proximity=${center.lng},${center.lat}` : "";
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&limit=6&types=address,place,postcode,locality,neighborhood${proximity}`;
        const data = await fetch(url).then(r => r.json());
        setResults(data.features || []);
        setOpen(true);
      } catch {}
      setSearching(false);
    }, 250);
  }

  function selectResult(feature) {
    const [lng, lat] = feature.center;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 11, duration: 1200 });
    setQuery(feature.place_name || feature.text || "");
    setOpen(false);
    setResults([]);
    if (!hasSelected.current) {
      hasSelected.current = true;
      onFirstSelect?.({ lng, lat, zoom: 11 });
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "Enter" && results.length > 0) selectResult(results[0]);
  }

  if (!mapReady) return null;

  return (
    <div ref={wrapRef} style={{ position: "absolute", top: 14, left: 14, right: 56, maxWidth: 420, zIndex: 10 }}>
      <div style={{ background: "#fff", border: "1px solid #E9ECF0", borderRadius: 10, boxShadow: "0 4px 12px rgba(15,23,42,0.08)", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 40 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { results.length > 0 && setOpen(true); setShowTip(false); }}
          placeholder="Jump to city, address, or ZIP…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#0F172A", background: "transparent", fontFamily: "inherit" }}
        />
        {searching && <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin flex-shrink-0" />}
        {query && !searching && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            style={{ color: "#9CA3AF", fontSize: 16, lineHeight: 1, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0 }}>×</button>
        )}
        {!query && (
          <span style={{ fontSize: 10, color: "#9CA3AF", padding: "2px 6px", border: "1px solid #E5E7EB", borderRadius: 4, background: "#FAFAFA", fontFamily: "monospace", flexShrink: 0 }}>⌘K</span>
        )}
      </div>

      {/* First-time tooltip */}
      {showTip && !query && (
        <div style={{ marginTop: 6, padding: "9px 14px", background: "#3486cf", borderRadius: 10, boxShadow: "0 4px 14px rgba(52,134,207,0.28)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 500 }}>
            Start by searching for your city or address →
          </p>
        </div>
      )}

      {open && results.length > 0 && (
        <div style={{ marginTop: 4, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.10)", overflow: "hidden" }}>
          {results.map((f, i) => (
            <button key={f.id} onClick={() => selectResult(f)} className="w-full text-left transition-colors"
              style={{ padding: "9px 14px", borderBottom: i < results.length - 1 ? "1px solid #F3F4F6" : "none", display: "block", background: "transparent", border: "none", cursor: "pointer", borderBottomColor: "#F3F4F6", width: "100%", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#0F172A" }} className="truncate">{f.text}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#9CA3AF" }} className="truncate">{f.place_name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ServiceAreaStep() {
  const router = useRouter();
  const { tenant, onboarding, saveOnboarding, patch } = useOnboarding();

  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const drawRef         = useRef(null);
  const mapLoadedRef    = useRef(false);
  const zonesRef        = useRef([]);

  const [zones,          setZones]          = useState([]);
  const [teamMembers,    setTeamMembers]    = useState([]);
  const [mapsReady,      setMapsReady]      = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapError,       setMapError]       = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [drawingMode,    setDrawingMode]    = useState(false);
  const [pendingPaths,   setPendingPaths]   = useState(null);
  const [pendingDrawId,  setPendingDrawId]  = useState(null);
  const [firstZoneDone,  setFirstZoneDone]  = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [filterPhotog,   setFilterPhotog]   = useState("all");
  const [msg,            setMsg]            = useState({ text: "", type: "success" });
  const [loading,        setLoading]        = useState(true);

  // Fetch team members
  useEffect(() => {
    auth.currentUser?.getIdToken().then(async token => {
      const h = { Authorization: `Bearer ${token}` };
      const [zonesRes, teamRes] = await Promise.all([
        fetch("/api/dashboard/service-areas", { headers: h }),
        fetch("/api/dashboard/team",          { headers: h }),
      ]);
      if (zonesRes.ok) { const d = await zonesRes.json(); setZones(d.zones || []); }
      if (teamRes.ok)  { const d = await teamRes.json();  setTeamMembers(d.members || []); }
      setLoading(false);
    });
  }, []);

  // Load Mapbox + Draw
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (window.mapboxgl && window.MapboxDraw) { setMapsReady(true); return; }

    function injectLink(href, id) {
      if (!document.getElementById(id)) {
        const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = href;
        document.head.appendChild(l);
      }
    }
    function injectScript(src, id, windowKey, onReady) {
      if (window[windowKey]) { onReady(); return; }
      const existing = document.getElementById(id);
      if (existing) { existing.addEventListener("load", onReady, { once: true }); return; }
      const s = document.createElement("script"); s.id = id; s.src = src; s.async = true;
      s.addEventListener("load", onReady, { once: true });
      document.head.appendChild(s);
    }

    injectLink("https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css", "mapbox-css");
    injectLink("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css", "mapboxdraw-css");
    injectScript(
      "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js", "mapbox-js", "mapboxgl",
      () => injectScript(
        "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js", "mapboxdraw-js", "MapboxDraw",
        () => setMapsReady(true)
      )
    );
  }, []);

  // Init map
  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapLoadedRef.current) return;
    if (!window.mapboxgl || !window.MapboxDraw) return;
    if (!window.mapboxgl.supported()) { setMapError(true); return; }

    mapLoadedRef.current = true;
    window.mapboxgl.accessToken = MAPBOX_TOKEN;

    const currentZones = zonesRef.current;
    const hasZones     = currentZones.some(z => z.paths?.length >= 3);
    let initCenter     = [-98.5795, 39.8283];
    let initZoom       = 4;

    if (!hasZones) {
      const dc = tenant?.defaultCoords;
      if (dc?.lng && dc?.lat) { initCenter = [dc.lng, dc.lat]; initZoom = dc.zoom || 10; }
    }

    requestAnimationFrame(() => {
      if (!mapContainerRef.current) return;
      let map;
      try {
        map = new window.mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v11",
          center: initCenter, zoom: initZoom, attributionControl: true,
        });
      } catch { mapLoadedRef.current = false; setMapError(true); return; }

      mapRef.current = map;
      const draw = new window.MapboxDraw({ displayControlsDefault: false, controls: {}, defaultMode: "simple_select" });
      map.addControl(draw);
      drawRef.current = draw;

      map.on("draw.create", e => {
        const feature = e.features[0];
        const paths   = feature.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
        setPendingPaths(paths);
        setPendingDrawId(feature.id);
        setEditing({ isNew: true, paths });
        setDrawingMode(false);
      });

      map.on("load", () => {
        setMapInitialized(true);
        renderZones();
        const allCoords = zonesRef.current.flatMap(z => (z.paths || []).map(p => [p.lng, p.lat]));
        if (allCoords.length >= 2) {
          try {
            const bounds = allCoords.reduce((b, c) => b.extend(c), new window.mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
            map.fitBounds(bounds, { padding: 60, maxZoom: 13, animate: false });
          } catch {}
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  zonesRef.current = zones;

  const renderZones = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) { map.once("idle", renderZones); return; }
    try {
      (map.getStyle()?.layers || []).filter(l => l.id.startsWith("zone-")).forEach(l => { try { map.removeLayer(l.id); } catch {} });
      Object.keys(map.getStyle()?.sources || {}).filter(s => s.startsWith("zone-")).forEach(s => { try { map.removeSource(s); } catch {} });
      zonesRef.current.forEach(zone => {
        if (!zone.paths?.length) return;
        const color  = zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6");
        const coords = [...zone.paths.map(p => [p.lng, p.lat]), [zone.paths[0].lng, zone.paths[0].lat]];
        const srcId  = `zone-${zone.id}`;
        map.addSource(srcId, { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } } });
        map.addLayer({ id: `zone-fill-${zone.id}`, type: "fill",   source: srcId, paint: { "fill-color": color, "fill-opacity": 0.2 } });
        map.addLayer({ id: `zone-line-${zone.id}`, type: "line",   source: srcId, paint: { "line-color": color, "line-width": 2 } });
        map.on("click",      `zone-fill-${zone.id}`, () => setEditing(zone));
        map.on("mouseenter", `zone-fill-${zone.id}`, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", `zone-fill-${zone.id}`, () => { map.getCanvas().style.cursor = ""; });
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mapInitialized) renderZones(); }, [zones, mapInitialized, renderZones]);

  function startDrawing() {
    if (!drawRef.current) return;
    drawRef.current.changeMode("draw_polygon");
    setDrawingMode(true);
  }

  function cancelDrawing() {
    if (drawRef.current && pendingDrawId) drawRef.current.delete(pendingDrawId);
    setPendingPaths(null); setPendingDrawId(null);
    setDrawingMode(false); setEditing(null);
  }

  async function saveZone(formData) {
    const token   = await auth.currentUser.getIdToken();
    const isNew   = editing?.isNew;
    const paths   = editing?.paths || pendingPaths || [];
    const payload = { ...formData, paths };

    if (isNew) {
      const res  = await fetch("/api/dashboard/service-areas", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setZones(prev => [...prev, data.zone]);
      if (pendingDrawId) drawRef.current?.delete(pendingDrawId);
      if (!firstZoneDone) setFirstZoneDone(true);
    } else {
      await fetch(`/api/dashboard/service-areas/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setZones(prev => prev.map(z => z.id === editing.id ? { ...z, ...payload } : z));
    }

    setPendingPaths(null); setPendingDrawId(null); setEditing(null);
    showMsg("Zone saved.", "success");
  }

  async function deleteZone() {
    if (!editing?.id) { cancelDrawing(); return; }
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/service-areas/${editing.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setZones(prev => prev.filter(z => z.id !== editing.id));
    setEditing(null);
    showMsg("Zone deleted.", "success");
  }

  function showMsg(text, type = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 3500);
  }

  // Write defaultCoords on first address search selection
  async function handleFirstSelect(coords) {
    await patch({ defaultCoords: coords }).catch(() => {});
  }

  function recenterMap() {
    const allCoords = zones.flatMap(z => (z.paths || []).map(p => [p.lng, p.lat]));
    if (allCoords.length >= 2 && mapRef.current) {
      try {
        const bounds = allCoords.reduce((b, c) => b.extend(c), new window.mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
      } catch {}
    }
  }

  async function handleContinue() {
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), serviceArea: true },
      currentStep: 5,
    });
    router.push("/onboarding/review");
  }

  async function handleSkipConfirm() {
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), serviceArea: true },
      skipped:   { ...(onboarding?.skipped   || {}), serviceArea: true },
      currentStep: 5,
    });
    router.push("/onboarding/review");
  }

  const sortedZones = [...zones].sort((a, b) => {
    if (a.type === b.type) return (a.name || "").localeCompare(b.name || "");
    return a.type === "include" ? -1 : 1;
  });

  const visibleZones = filterPhotog === "all" ? sortedZones : sortedZones.filter(z => z.assignedTo?.includes(filterPhotog));

  const canContinue = zones.length > 0;

  return (
    <StepCard
      wide
      eyebrow="Step 4 of 5 · Service Areas"
      headline="Where do you work?"
      lede="Draw zones on the map to define where you take jobs and assign photographers to each area. You can edit these anytime from Service Areas."
      footer={
        <>
          <button className="btn-ghost" onClick={() => router.push("/onboarding/team")}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!showSkipConfirm ? (
              <button className="btn-ghost" onClick={() => setShowSkipConfirm(true)}>Skip for now</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, padding: "8px 14px", fontSize: 13 }}>
                <span style={{ color: "#DC2626", fontWeight: 500 }}>Skip service areas?</span>
                <button onClick={handleSkipConfirm} style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, background: "none", border: "1px solid #FECACA", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Yes, skip</button>
                <button onClick={() => setShowSkipConfirm(false)} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: "3px 6px" }}>Cancel</button>
              </div>
            )}
            <button className="btn-primary" onClick={handleContinue} disabled={!canContinue}>
              Continue → Review
            </button>
          </div>
        </>
      }
    >
      {/* Toast */}
      {msg.text && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500,
          background: msg.type === "warn" ? "#FFFBEB" : "#ECFDF5",
          border: `1px solid ${msg.type === "warn" ? "#FCD34D" : "#6EE7B7"}`,
          color: msg.type === "warn" ? "#92400E" : "#065F46" }}>
          {msg.text}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        {/* Filter chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" }}>View:</span>
          <button onClick={() => setFilterPhotog("all")}
            style={{ height: 30, padding: "0 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: filterPhotog === "all" ? "1.5px solid #3486cf" : "1px solid #E9ECF0", background: filterPhotog === "all" ? "#3486cf" : "#fff", color: filterPhotog === "all" ? "#fff" : "#475569", transition: "all 0.12s" }}>
            All Zones
          </button>
          {teamMembers.filter(m => m.role === "photographer" || !m.role).map(m => (
            <button key={m.id} onClick={() => setFilterPhotog(m.id)}
              style={{ height: 30, padding: "0 12px 0 4px", borderRadius: 99, fontSize: 12, cursor: "pointer", border: filterPhotog === m.id ? "1.5px solid #3486cf" : "1px solid #E9ECF0", background: filterPhotog === m.id ? "#EEF4FA" : "#fff", color: filterPhotog === m.id ? "#1E5A8A" : "#475569", display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.12s" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.color || avatarColor(m.name || "?"), color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {initials(m.name || "?").slice(0, 1)}
              </div>
              {(m.name || "").split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn-primary" onClick={startDrawing} disabled={drawingMode}>
            + Draw New Zone
          </button>
        </div>
      </div>

      {/* Drawing banner */}
      {drawingMode && (
        <div style={{ marginBottom: 10, padding: "9px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13, color: "#1D4ED8" }}>Click on the map to place points. Click the first point to close the shape.</span>
          </div>
          <button onClick={cancelDrawing} style={{ fontSize: 12, color: "#6B7280", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
        </div>
      )}

      {/* Map + zone rail */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        {/* Map */}
        <div style={{ position: "relative", height: 460, borderRadius: 12, overflow: "hidden", border: "1px solid #E9ECF0" }}>
          {!MAPBOX_TOKEN && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F7F4", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Map unavailable — NEXT_PUBLIC_MAPBOX_TOKEN not set</p>
            </div>
          )}
          {mapError && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F7F4", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Map failed to load.</p>
            </div>
          )}
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Address search */}
          <AddressSearch mapRef={mapRef} mapReady={mapInitialized} onFirstSelect={handleFirstSelect} />

          {/* Floating map controls */}
          {!drawingMode && mapInitialized && (
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
              {[
                { label: "⊕", title: "Recenter", action: recenterMap },
                { label: "+", title: "Zoom in",  action: () => mapRef.current?.zoomIn()  },
                { label: "−", title: "Zoom out", action: () => mapRef.current?.zoomOut() },
              ].map(btn => (
                <button key={btn.label} title={btn.title} onClick={btn.action}
                  style={{ width: 32, height: 32, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px rgba(15,23,42,0.08)", color: "#475569" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Zones ({zones.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            {visibleZones.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px dashed #E9ECF0", borderRadius: 12, padding: "32px 16px", minHeight: 120 }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20.25l-6.75-6.75 6.75-6.75M15 20.25l6.75-6.75-6.75-6.75"/>
                </svg>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>No zones yet.<br/>Draw one to get started.</p>
              </div>
            ) : (
              visibleZones.map(zone => (
                <div key={zone.id}
                  onClick={() => setEditing(zone)}
                  style={{ padding: "10px 12px", border: "1px solid #E9ECF0", borderRadius: 12, background: "#fff", cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,23,42,0.08)"; e.currentTarget.style.borderColor = "#C7D2E8"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = "#E9ECF0"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6"), flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>{zone.name}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: zone.type === "exclude" ? "#DC2626" : "#059669" }}>
                    {zone.type === "exclude" ? "Excluded" : "Service area"}
                  </p>
                  {zone.assignedTo?.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 6 }}>
                      {zone.assignedTo.slice(0, 4).map((uid, k) => {
                        const m = teamMembers.find(t => t.id === uid);
                        return (
                          <div key={uid} style={{ width: 20, height: 20, borderRadius: "50%", background: m?.color || avatarColor(m?.name || uid), color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff", marginLeft: k > 0 ? -6 : 0, zIndex: k, flexShrink: 0 }}>
                            {initials(m?.name || "?").slice(0, 1)}
                          </div>
                        );
                      })}
                      <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 6 }}>{zone.assignedTo.length} photographer{zone.assignedTo.length > 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {zone.notes && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#9CA3AF", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{zone.notes}</p>}
                </div>
              ))
            )}
          </div>

          {/* Help callout */}
          <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(201,169,110,0.10)", border: "1px solid #E8C97A", borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
              <strong>Tip:</strong> Assign photographers to zones so bookings are automatically routed when a client books a job in that area.
            </p>
          </div>
        </div>
      </div>

      {/* Zone modal */}
      {editing && (
        <ZoneModal
          zone={editing?.isNew ? null : editing}
          teamMembers={teamMembers}
          firstTime={editing?.isNew && !firstZoneDone}
          onSave={saveZone}
          onDelete={deleteZone}
          onClose={cancelDrawing}
        />
      )}
    </StepCard>
  );
}
