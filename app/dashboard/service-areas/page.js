"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { ZONE_COLORS } from "@/lib/zoneColors";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ── Zone modal ────────────────────────────────────────────────────────────────

function ZoneModal({ zone, teamMembers, onSave, onDelete, onClose }) {
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
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E9ECF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{zone ? "Edit Zone" : "New Zone"}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#9CA3AF", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Zone Name</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Los Angeles, Miami Beach"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "#3486cf"; e.target.style.boxShadow = "0 0 0 3px rgba(52,134,207,0.12)"; }}
              onBlur={e => { e.target.style.borderColor = "#E9ECF0"; e.target.style.boxShadow = "none"; }} />
          </div>

          {/* Zone type toggle */}
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
                    style={{
                      padding: 12, borderRadius: 9, textAlign: "left", cursor: "pointer",
                      border: on ? `1.5px solid ${isExclude ? "#DC2626" : "#3486cf"}` : "1.5px solid #E9ECF0",
                      background: on ? (isExclude ? "#FEE2E2" : "#EEF4FA") : "#fff",
                      transition: "all 0.12s",
                    }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: on ? (isExclude ? "#DC2626" : "#0F172A") : "#6B7280" }}>{opt.label}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#9CA3AF" }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <label style={labelStyle}>Zone Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ZONE_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                    transform: form.color === c ? "scale(1.1)" : "scale(1)",
                    boxShadow: form.color === c ? "0 0 0 2px #fff, 0 0 0 4px #9CA3AF" : "none",
                    transition: "all 0.12s",
                  }} />
              ))}
            </div>
          </div>

          {/* Photographers */}
          {teamMembers.length > 0 && (
            <div>
              <label style={labelStyle}>Assign Photographers</label>
              <p style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 8 }}>Only these photographers will be scheduled in this zone</p>
              <div style={{ border: "1px solid #E9ECF0", borderRadius: 9, padding: "4px 0", maxHeight: 160, overflowY: "auto" }}>
                {teamMembers.map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, border: form.assignedTo.includes(m.id) ? "none" : "1.5px solid #D1D5DB",
                      background: form.assignedTo.includes(m.id) ? "#3486cf" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
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

          {/* Notes */}
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

        {/* Footer */}
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

// ── Address search overlay ────────────────────────────────────────────────────

function AddressSearch({ mapRef, mapReady }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);
  const wrapRef     = useRef(null);

  // ⌘K / Ctrl-K focuses the input
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close dropdown on outside click
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
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1200 });
    setQuery(feature.place_name || feature.text || "");
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "Enter" && results.length > 0) selectResult(results[0]);
  }

  if (!mapReady) return null;

  return (
    <div ref={wrapRef} className="absolute z-10" style={{ top: 14, left: 14, right: 110, maxWidth: 420 }}>
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
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Jump to address, city, or ZIP…"
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
      {open && results.length > 0 && (
        <div style={{ marginTop: 4, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.10)", overflow: "hidden" }}>
          {results.map((f, i) => (
            <button key={f.id} onClick={() => selectResult(f)}
              className="w-full text-left transition-colors"
              style={{ padding: "9px 14px", borderBottom: i < results.length - 1 ? "1px solid #F3F4F6" : "none", display: "block", background: "transparent", border: "none", cursor: "pointer", borderBottomColor: "#F3F4F6" }}
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

export default function ServiceAreasPage() {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const drawRef         = useRef(null);
  const mapLoadedRef    = useRef(false);
  const zonesRef        = useRef([]);
  const fileInputRef    = useRef(null);

  const [zones,          setZones]          = useState([]);
  const [teamMembers,    setTeamMembers]    = useState([]);
  const [tenant,         setTenant]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [mapsReady,      setMapsReady]      = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapError,       setMapError]       = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [drawingMode,    setDrawingMode]    = useState(false);
  const [pendingPaths,   setPendingPaths]   = useState(null);
  const [pendingDrawId,  setPendingDrawId]  = useState(null);
  const [msg,            setMsg]            = useState({ text: "", type: "success" });
  const [filterPhotog,   setFilterPhotog]   = useState("all");
  const [importing,      setImporting]      = useState(false);

  const { permissions, userRole } = useDashboardPermissions();
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin" || userRole === null;

  // Load data
  useEffect(() => {
    auth.currentUser?.getIdToken().then(async token => {
      const h = { Authorization: `Bearer ${token}` };
      const [zonesRes, teamRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/service-areas", { headers: h }),
        fetch("/api/dashboard/team",          { headers: h }),
        fetch("/api/dashboard/tenant",        { headers: h }),
      ]);
      if (zonesRes.ok)  { const d = await zonesRes.json();  setZones(d.zones || []); }
      if (teamRes.ok)   { const d = await teamRes.json();   setTeamMembers(d.members || []); }
      if (tenantRes.ok) { const d = await tenantRes.json(); setTenant(d.tenant || null); }
      setLoading(false);
    });
  }, []);

  // Load Mapbox GL + Draw
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (window.mapboxgl && window.MapboxDraw) { setMapsReady(true); return; }

    function injectLink(href, id) {
      if (!document.getElementById(id)) {
        const l = document.createElement("link");
        l.id = id; l.rel = "stylesheet"; l.href = href;
        document.head.appendChild(l);
      }
    }
    function injectScript(src, id, windowKey, onReady) {
      if (window[windowKey]) { onReady(); return; }
      const existing = document.getElementById(id);
      if (existing) { existing.addEventListener("load", onReady, { once: true }); return; }
      const s = document.createElement("script");
      s.id = id; s.src = src; s.async = true;
      s.addEventListener("load", onReady, { once: true });
      document.head.appendChild(s);
    }

    injectLink("https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css",               "mapbox-css");
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

    // Determine initial center
    const currentZones = zonesRef.current;
    const hasZones = currentZones.some(z => z.paths?.length >= 3);

    let initCenter = [-98.5795, 39.8283]; // continental US
    let initZoom   = 4;

    if (!hasZones) {
      // Will fit bounds after load if zones exist, else use defaultCoords
      const dc = tenant?.defaultCoords;
      if (dc?.lng && dc?.lat) { initCenter = [dc.lng, dc.lat]; initZoom = dc.zoom || 10; }
    }

    requestAnimationFrame(() => {
      if (!mapContainerRef.current) return;
      let map;
      try {
        map = new window.mapboxgl.Map({
          container: mapContainerRef.current,
          style:     "mapbox://styles/mapbox/streets-v11",
          center:    initCenter,
          zoom:      initZoom,
          attributionControl: true,
        });
      } catch (err) {
        console.error("[service-areas] Map init failed:", err?.message);
        mapLoadedRef.current = false;
        setMapError(true);
        return;
      }
      mapRef.current = map;

      const draw = new window.MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: "simple_select",
      });
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
        // Fit to zones on first load
        const cur = zonesRef.current;
        const allCoords = cur.flatMap(z => (z.paths || []).map(p => [p.lng, p.lat]));
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

  // Keep zonesRef in sync
  zonesRef.current = zones;

  const renderZones = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) { map.once("idle", renderZones); return; }

    const cur = zonesRef.current;
    try {
      (map.getStyle()?.layers || [])
        .filter(l => l.id.startsWith("zone-"))
        .forEach(l => { try { map.removeLayer(l.id); } catch {} });
      Object.keys(map.getStyle()?.sources || {})
        .filter(s => s.startsWith("zone-"))
        .forEach(s => { try { map.removeSource(s); } catch {} });

      cur.forEach(zone => {
        if (!zone.paths?.length) return;
        const srcId  = `zone-${zone.id}`;
        const fillId = `zone-fill-${zone.id}`;
        const lineId = `zone-line-${zone.id}`;
        const color  = zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6");
        const coords = [...zone.paths.map(p => [p.lng, p.lat]), [zone.paths[0].lng, zone.paths[0].lat]];

        map.addSource(srcId, { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } } });
        map.addLayer({ id: fillId, type: "fill", source: srcId, paint: { "fill-color": color, "fill-opacity": 0.2 } });
        map.addLayer({ id: lineId, type: "line", source: srcId, paint: { "line-color": color, "line-width": 2 } });
        map.on("click",      fillId, () => setEditing(zone));
        map.on("mouseenter", fillId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", fillId, () => { map.getCanvas().style.cursor = ""; });
      });
    } catch (err) {
      console.error("[service-areas] renderZones error:", err?.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInitialized) return;
    renderZones();
  }, [zones, mapInitialized, renderZones]);

  function recenterMap() {
    const allCoords = zones.flatMap(z => (z.paths || []).map(p => [p.lng, p.lat]));
    if (allCoords.length >= 2 && mapRef.current) {
      try {
        const bounds = allCoords.reduce((b, c) => b.extend(c), new window.mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
      } catch {}
    }
  }

  function startDrawing() {
    if (!drawRef.current) return;
    drawRef.current.changeMode("draw_polygon");
    setDrawingMode(true);
  }

  function cancelDrawing() {
    if (drawRef.current && pendingDrawId) drawRef.current.delete(pendingDrawId);
    setPendingPaths(null);
    setPendingDrawId(null);
    setDrawingMode(false);
    setEditing(null);
  }

  async function saveZone(formData) {
    const token   = await auth.currentUser.getIdToken();
    const isNew   = editing?.isNew;
    const paths   = editing?.paths || pendingPaths || [];
    const payload = { ...formData, paths };

    if (isNew) {
      const res  = await fetch("/api/dashboard/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setZones(prev => [...prev, data.zone]);
      if (pendingDrawId) drawRef.current?.delete(pendingDrawId);
    } else {
      await fetch(`/api/dashboard/service-areas/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setZones(prev => prev.map(z => z.id === editing.id ? { ...z, ...payload } : z));
    }

    setPendingPaths(null);
    setPendingDrawId(null);
    setEditing(null);
    showMsg("Zone saved.", "success");
  }

  async function deleteZone() {
    if (!editing?.id) { cancelDrawing(); return; }
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/service-areas/${editing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setZones(prev => prev.filter(z => z.id !== editing.id));
    setEditing(null);
    showMsg("Zone deleted.", "success");
  }

  function showMsg(text, type = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 3500);
  }

  function retryMap() {
    setMapError(false);
    mapLoadedRef.current = false;
    setMapsReady(false);
    setTimeout(() => setMapsReady(true), 80);
  }

  async function handleGeoJSONImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text    = await file.text();
      const geojson = JSON.parse(text);
      const features = (geojson.type === "FeatureCollection" ? geojson.features : [geojson])
        .filter(f => f?.geometry?.type === "Polygon");

      if (!features.length) { showMsg("No Polygon features found in file.", "warn"); setImporting(false); return; }

      const token = await auth.currentUser.getIdToken();
      let count = 0;
      for (let i = 0; i < features.length; i++) {
        const f     = features[i];
        const name  = f.properties?.name || `Imported Zone ${i + 1}`;
        const paths = f.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
        const color = ZONE_COLORS[i % ZONE_COLORS.length];
        const res   = await fetch("/api/dashboard/service-areas", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, type: "include", color, paths, assignedTo: [], notes: "" }),
        });
        if (res.ok) {
          const data = await res.json();
          setZones(prev => [...prev, data.zone]);
          count++;
        }
      }
      showMsg(`Imported ${count} zone${count !== 1 ? "s" : ""} from ${file.name}.`, "success");
    } catch {
      showMsg("Failed to parse GeoJSON.", "warn");
    }
    setImporting(false);
    e.target.value = "";
  }

  const visibleZones = filterPhotog === "all"
    ? zones
    : zones.filter(z => z.assignedTo?.includes(filterPhotog));

  const sortedVisibleZones = [...visibleZones].sort((a, b) => {
    if (a.type === b.type) return (a.name || "").localeCompare(b.name || "");
    return a.type === "include" ? -1 : 1;
  });

  if (!MAPBOX_TOKEN) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-2">Service Areas</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="font-medium text-amber-800 mb-1">Mapbox token required</p>
          <p className="text-sm text-amber-700">
            Add <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your environment variables to enable map drawing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="page-title">Service Areas</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>Draw zones where you work and assign photographers to each area</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOwnerOrAdmin && (
            <>
              <input ref={fileInputRef} type="file" accept=".json,.geojson" style={{ display: "none" }} onChange={handleGeoJSONImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || !mapInitialized}
                style={{ height: 36, padding: "0 14px", border: "1px solid #E9ECF0", background: "#fff", color: "#475569", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: importing || !mapInitialized ? 0.5 : 1 }}
                onMouseEnter={e => { if (!importing && mapInitialized) e.currentTarget.style.borderColor = "#C7D2E8"; }}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#E9ECF0"}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {importing ? "Importing…" : "Import GeoJSON"}
              </button>
            </>
          )}
          {!drawingMode ? (
            <button onClick={startDrawing} disabled={!mapInitialized}
              style={{ height: 36, padding: "0 16px", border: "1px solid #3486cf", background: "#3486cf", color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: !mapInitialized ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: !mapInitialized ? 0.5 : 1 }}
              onMouseEnter={e => { if (mapInitialized) e.currentTarget.style.background = "#2a6dab"; }}
              onMouseLeave={e => e.currentTarget.style.background = "#3486cf"}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Draw New Zone
            </button>
          ) : (
            <button onClick={cancelDrawing}
              style={{ height: 36, padding: "0 16px", border: "1px solid #E9ECF0", background: "#fff", color: "#475569", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              Cancel Drawing
            </button>
          )}
        </div>
      </div>

      {/* ── Filter row ── */}
      {teamMembers.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4 }}>View:</span>
          <button onClick={() => setFilterPhotog("all")}
            style={{
              height: 30, padding: "0 14px", borderRadius: 99, border: "1px solid",
              borderColor: filterPhotog === "all" ? "#3486cf" : "#E9ECF0",
              background: filterPhotog === "all" ? "#3486cf" : "#fff",
              color: filterPhotog === "all" ? "#fff" : "#4B5261",
              fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center",
            }}>
            All Zones
          </button>
          {teamMembers.map(m => {
            const on = filterPhotog === m.id;
            return (
              <button key={m.id} onClick={() => setFilterPhotog(m.id)}
                style={{
                  height: 30, padding: "0 12px 0 6px", borderRadius: 99, border: "1px solid",
                  borderColor: on ? "#3486cf" : "#E9ECF0",
                  background: on ? "#3486cf" : "#fff",
                  color: on ? "#fff" : "#4B5261",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 7,
                }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: on ? "rgba(255,255,255,0.3)" : (m.color || "#6B7280"), color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {m.name?.[0]?.toUpperCase()}
                </div>
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toast ── */}
      {msg.text && (
        <div style={{
          padding: "8px 16px", borderRadius: 9, marginBottom: 14, fontSize: 13,
          background: msg.type === "warn" ? "#FEF3C7" : "#ECFDF5",
          border: `1px solid ${msg.type === "warn" ? "#FDE68A" : "#A7F3D0"}`,
          color: msg.type === "warn" ? "#92400E" : "#059669",
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Body: map + rail ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "flex-start" }}
        className="block lg:grid">

        {/* Map column */}
        <div>
          {/* Drawing banner */}
          {drawingMode && (
            <div style={{
              marginBottom: 10, background: "#DBEAFE", border: "1px solid #93C5FD", color: "#1D4ED8",
              padding: "9px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 2px 6px rgba(29,78,216,0.08)",
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Click on the map to place points. Click the first point again to close the shape.
            </div>
          )}

          {/* Map card */}
          <div style={{ position: "relative", height: 640, borderRadius: 14, overflow: "hidden", border: "1px solid #E9ECF0", background: "#E8E5DC" }}
            className="h-[380px] sm:h-[520px] lg:h-[640px]">

            {mapError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <p className="text-sm font-medium text-gray-600">Map failed to load</p>
                <p className="text-xs text-gray-400 max-w-xs">WebGL is required. Enable hardware acceleration and reload.</p>
                <button onClick={retryMap} style={{ height: 32, padding: "0 14px", border: "1px solid #E9ECF0", background: "#fff", color: "#475569", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Retry</button>
              </div>
            ) : !mapsReady ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              </div>
            ) : null}

            {/* Address search */}
            <AddressSearch mapRef={mapRef} mapReady={mapInitialized} />

            {/* Floating map controls — right side, hidden while drawing */}
            {mapInitialized && !drawingMode && (
              <div style={{ position: "absolute", top: 14, right: 14, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
                {[
                  { title: "Recenter", onClick: recenterMap, icon: (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )},
                  { title: "Zoom in",  onClick: () => mapRef.current?.zoomIn(),  icon: (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                  )},
                  { title: "Zoom out", onClick: () => mapRef.current?.zoomOut(), icon: (
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                    </svg>
                  )},
                ].map(ctrl => (
                  <button key={ctrl.title} title={ctrl.title} onClick={ctrl.onClick}
                    style={{ width: 36, height: 36, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", cursor: "pointer", boxShadow: "0 2px 6px rgba(15,23,42,0.06)" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#C7D2E8"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#E9ECF0"}>
                    {ctrl.icon}
                  </button>
                ))}
              </div>
            )}

            <div ref={mapContainerRef} className={`w-full h-full${mapError ? " hidden" : ""}`} style={{ position: "absolute", inset: 0 }} />
          </div>
        </div>

        {/* Zone rail */}
        <div className="mt-4 lg:mt-0">
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Zones ({sortedVisibleZones.length})
          </p>

          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            </div>
          )}

          {!loading && sortedVisibleZones.length === 0 && (
            <div style={{ border: "1.5px dashed #E9ECF0", borderRadius: 14, padding: "32px 16px", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EEF4FA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", margin: 0 }}>
                {filterPhotog === "all" ? "No zones yet." : "No zones for this photographer."}
              </p>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                {filterPhotog === "all" ? 'Click "Draw New Zone" to start.' : "Draw a zone and assign them to it."}
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedVisibleZones.map(zone => {
              const dotColor  = zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6");
              const assigned  = (zone.assignedTo || []).map(uid => teamMembers.find(m => m.id === uid)).filter(Boolean);
              const isExclude = zone.type === "exclude";

              return (
                <div key={zone.id}
                  onClick={() => setEditing(zone)}
                  style={{
                    background: "#fff", border: "1px solid #E9ECF0", borderRadius: 12,
                    padding: "12px 14px", cursor: "pointer",
                    opacity: isExclude ? 0.92 : 1,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.09)"; e.currentTarget.style.borderColor = "#C7D2E8"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#E9ECF0"; }}>

                  {/* Name + dot */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#0F172A" }} className="truncate">{zone.name}</p>
                    </div>
                  </div>

                  {/* Type label */}
                  <p style={{ margin: "0 0 8px 18px", fontSize: 11, fontWeight: 600, color: isExclude ? "#DC2626" : "#059669" }}>
                    {isExclude ? "Excluded" : "Service area"}
                  </p>

                  {/* Photographer avatars */}
                  {assigned.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 18 }}>
                      <div style={{ display: "flex" }}>
                        {assigned.slice(0, 4).map((m, i) => (
                          <div key={m.id} title={m.name}
                            style={{
                              width: 20, height: 20, borderRadius: "50%", background: m.color || "#6B7280",
                              color: "#fff", fontSize: 9, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "1.5px solid #fff",
                              marginLeft: i > 0 ? -6 : 0, zIndex: assigned.length - i,
                              position: "relative",
                            }}>
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{assigned.length} photographer{assigned.length !== 1 ? "s" : ""}</span>
                    </div>
                  ) : (
                    <p style={{ margin: "0 0 0 18px", fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>Unassigned</p>
                  )}

                  {/* Notes */}
                  {zone.notes && (
                    <p style={{ margin: "6px 0 0 18px", fontSize: 11.5, color: "#9CA3AF", fontStyle: "italic" }} className="truncate">
                      {zone.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zone modal */}
      {editing && (
        <ZoneModal
          zone={editing.isNew ? null : editing}
          teamMembers={teamMembers}
          onSave={saveZone}
          onDelete={deleteZone}
          onClose={cancelDrawing}
        />
      )}
    </div>
  );
}
