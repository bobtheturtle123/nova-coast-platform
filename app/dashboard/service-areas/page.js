"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { auth } from "@/lib/firebase";

const ZONE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

function ZoneModal({ zone, teamMembers, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name:        zone?.name        || "",
    type:        zone?.type        || "include",
    color:       zone?.color       || ZONE_COLORS[0],
    assignedTo:  zone?.assignedTo  || [],
    notes:       zone?.notes       || "",
  });
  const [saving, setSaving] = useState(false);

  function toggleMember(id) {
    setForm((f) => ({
      ...f,
      assignedTo: f.assignedTo.includes(id)
        ? f.assignedTo.filter((x) => x !== id)
        : [...f.assignedTo, id],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-charcoal text-base">{zone ? "Edit Zone" : "New Zone"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label-field">Zone Name</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="e.g. Los Angeles, Miami Beach" />
          </div>

          <div>
            <label className="label-field">Zone Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "include", label: "Service Area", desc: "You work in this zone" },
                { value: "exclude", label: "Excluded Area", desc: "You don't work here" },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setForm((f) => ({ ...f, type: opt.value }))}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    form.type === opt.value
                      ? opt.value === "include" ? "border-charcoal bg-charcoal/5" : "border-red-300 bg-red-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <p className={`text-sm font-medium ${form.type === opt.value ? opt.value === "include" ? "text-charcoal" : "text-red-600" : "text-gray-600"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Zone Color</label>
            <div className="flex gap-2 flex-wrap">
              {ZONE_COLORS.map((c) => (
                <button key={c} type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`} />
              ))}
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label className="label-field">Assign Photographers</label>
              <p className="text-xs text-gray-400 mb-2">Only these photographers will be scheduled for jobs in this zone</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {teamMembers.map((m) => (
                  <label key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox"
                      checked={form.assignedTo.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="rounded" />
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: m.color || "#6B7280" }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-charcoal">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label-field">Notes (optional)</label>
            <input type="text" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field w-full" placeholder="e.g. Avoid during rush hour" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {zone
            ? <button onClick={onDelete} className="text-sm text-red-500 hover:text-red-700">Delete zone</button>
            : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary px-6 py-2 text-sm">
              {saving ? "Saving…" : "Save Zone"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceAreasPage() {
  const mapRef        = useRef(null);
  const googleMapRef  = useRef(null);
  const drawingMgrRef = useRef(null);
  const overlaysRef   = useRef({});  // zoneId → google.maps.Polygon

  const [zones,       setZones]       = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [mapsReady,   setMapsReady]   = useState(false);
  const [editing,     setEditing]     = useState(null); // null | zone object (with pendingPaths)
  const [pendingZone, setPendingZone] = useState(null); // polygon drawn but not yet saved
  const [drawingMode, setDrawingMode] = useState(false);
  const [msg,         setMsg]         = useState("");
  const [filterPhotog, setFilterPhotog] = useState("all"); // "all" | memberId

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

  // Load data
  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [zonesRes, teamRes] = await Promise.all([
        fetch("/api/dashboard/service-areas", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (zonesRes.ok) { const d = await zonesRes.json(); setZones(d.zones || []); }
      if (teamRes.ok)  { const d = await teamRes.json();  setTeamMembers(d.members || []); }
      setLoading(false);
    });
  }, []);

  // Load Google Maps
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) { setMapsReady(false); return; }
    if (window.google?.maps) { setMapsReady(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=drawing,geometry`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapsReady || !mapRef.current || googleMapRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 34.0522, lng: -118.2437 },
      zoom: 9,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    googleMapRef.current = map;

    const dm = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#3B82F6",
        fillOpacity: 0.25,
        strokeColor: "#3B82F6",
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    dm.setMap(map);
    drawingMgrRef.current = dm;

    window.google.maps.event.addListener(dm, "polygoncomplete", (polygon) => {
      dm.setDrawingMode(null);
      setDrawingMode(false);
      const paths = polygon.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
      setPendingZone({ polygon, paths });
      setEditing({ isNew: true, pendingPolygon: polygon, paths });
    });
  }, [mapsReady]);

  // Render saved zones on map
  useEffect(() => {
    if (!googleMapRef.current) return;
    // Clear existing
    Object.values(overlaysRef.current).forEach((p) => p.setMap(null));
    overlaysRef.current = {};
    // Draw zones
    zones.forEach((zone) => {
      if (!zone.paths?.length) return;
      const color = zone.color || "#3B82F6";
      const poly  = new window.google.maps.Polygon({
        paths: zone.paths,
        fillColor: zone.type === "exclude" ? "#EF4444" : color,
        fillOpacity: 0.2,
        strokeColor: zone.type === "exclude" ? "#EF4444" : color,
        strokeWeight: 2,
        map: googleMapRef.current,
      });
      poly.addListener("click", () => setEditing(zone));
      overlaysRef.current[zone.id] = poly;
    });
  }, [zones, mapsReady]);

  function startDrawing() {
    if (!drawingMgrRef.current) return;
    drawingMgrRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    setDrawingMode(true);
  }

  function cancelDrawing() {
    if (drawingMgrRef.current) drawingMgrRef.current.setDrawingMode(null);
    if (pendingZone?.polygon) pendingZone.polygon.setMap(null);
    setPendingZone(null);
    setDrawingMode(false);
    setEditing(null);
  }

  async function saveZone(formData) {
    const token = await auth.currentUser.getIdToken();
    const isNew = editing?.isNew;
    const paths = editing?.paths || editing?.pendingPolygon
      ? editing.paths
      : editing?.paths;

    const payload = { ...formData, paths: paths || editing?.paths || [] };

    if (isNew) {
      const res = await fetch("/api/dashboard/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setZones((prev) => [...prev, data.zone]);
      if (pendingZone?.polygon) {
        pendingZone.polygon.setMap(null);
      }
    } else {
      await fetch(`/api/dashboard/service-areas/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setZones((prev) => prev.map((z) => z.id === editing.id ? { ...z, ...payload } : z));
    }

    setPendingZone(null);
    setEditing(null);
    showMsg("Zone saved.");
  }

  async function deleteZone() {
    if (!editing?.id) { cancelDrawing(); return; }
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/service-areas/${editing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setZones((prev) => prev.filter((z) => z.id !== editing.id));
    setEditing(null);
    showMsg("Zone deleted.");
  }

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  const noMapsKey = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const visibleZones = filterPhotog === "all"
    ? zones
    : zones.filter((z) => z.assignedTo?.includes(filterPhotog));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold text-xl text-charcoal">Service Areas</h1>
          <p className="text-gray-400 text-sm mt-0.5">Draw zones where you work and assign photographers to each area</p>
        </div>
        {!noMapsKey && !drawingMode && (
          <button onClick={startDrawing} className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
            <span className="text-base leading-none">+</span>
            Draw New Zone
          </button>
        )}
        {drawingMode && (
          <button onClick={cancelDrawing} className="btn-outline text-sm px-5 py-2">
            Cancel Drawing
          </button>
        )}
      </div>

      {/* Photographer filter */}
      {teamMembers.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">View:</span>
          <button onClick={() => setFilterPhotog("all")}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterPhotog === "all" ? "bg-navy text-white border-navy" : "text-gray-500 border-gray-200 hover:border-navy/40"}`}>
            All Zones
          </button>
          {teamMembers.map((m) => (
            <button key={m.id} onClick={() => setFilterPhotog(m.id)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${filterPhotog === m.id ? "bg-navy text-white border-navy" : "text-gray-500 border-gray-200 hover:border-navy/40"}`}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ background: m.color || "#6B7280" }}>
                {m.name?.[0]?.toUpperCase()}
              </div>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg mb-4">
          {msg}
        </div>
      )}

      {drawingMode && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Click on the map to draw a zone. Click the first point again to close the shape.
        </div>
      )}

      {noMapsKey ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="font-medium text-amber-800 mb-1">Google Maps API key required</p>
          <p className="text-sm text-amber-700">
            Add <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to your Vercel environment variables to enable map drawing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-card" style={{ height: 520 }}>
              {!mapsReady && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              )}
              <div ref={mapRef} className="w-full h-full" />
            </div>
          </div>

          {/* Zone list */}
          <div className="lg:col-span-1 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zones ({visibleZones.length})</p>

            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              </div>
            )}

            {!loading && visibleZones.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-card">
                <p className="text-sm text-gray-400">{filterPhotog === "all" ? "No zones yet." : "No zones assigned to this photographer."}</p>
                <p className="text-xs text-gray-400 mt-1">{filterPhotog === "all" ? 'Click "Draw New Zone" to start.' : "Draw a zone and assign this photographer to it."}</p>
              </div>
            )}

            {visibleZones.map((zone) => (
              <div key={zone.id}
                onClick={() => setEditing(zone)}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-card cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6") }} />
                  <p className="text-sm font-medium text-charcoal truncate">{zone.name}</p>
                </div>
                <p className={`text-xs font-medium mb-1.5 ${zone.type === "exclude" ? "text-red-500" : "text-green-600"}`}>
                  {zone.type === "exclude" ? "Excluded" : "Service area"}
                </p>
                {zone.assignedTo?.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {zone.assignedTo.map((uid) => {
                      const m = teamMembers.find((x) => x.id === uid);
                      if (!m) return null;
                      return (
                        <div key={uid} title={m.name}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ background: m.color || "#6B7280" }}>
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                      );
                    })}
                    <span className="text-xs text-gray-400">{zone.assignedTo.length} photographer{zone.assignedTo.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {zone.notes && <p className="text-xs text-gray-400 mt-1 truncate">{zone.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

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
