"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { getAppUrl } from "@/lib/appUrl";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";
import { payLabel, paidAmount } from "@/lib/payment";
import { avatarColor, initials } from "@/lib/avatar";
import { getEffectivePlan } from "@/lib/plans";
import { isDemo, getDemoDashboard } from "@/lib/demoData";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
// Statuses that count as "in production" — excludes completed and cancelled
const ACTIVE_STAGES = [
  "booked", "appointment_confirmed", "photographer_assigned",
  "shot_completed", "editing_complete", "qa_review",
  "delivered", "revisions", "postponed",
];

// Returns { y, w } ISO week for a date string "YYYY-MM-DD"
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  return { y: d.getFullYear(), w: 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7) };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, dot, href, anchorId }) {
  const inner = (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-bold uppercase tracking-[0.09em]" style={{ color: "#9CA3AF" }}>{label}</p>
        {dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />}
      </div>
      <p className="text-[26px] font-bold leading-none tracking-tight mb-1.5" style={{ color: "#0F172A" }}>{value}</p>
      <p className="text-[14px]" style={{ color: "#9CA3AF" }}>{sub}</p>
    </div>
  );
  const cls = "block bg-white rounded-xl transition-shadow hover:shadow-md";
  const style = { border: "1px solid #E9ECF0" };
  if (anchorId) {
    return (
      <button onClick={() => document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" })}
        className={`w-full text-left ${cls}`} style={style}>
        {inner}
      </button>
    );
  }
  if (href) return <Link href={href} className={cls} style={style}>{inner}</Link>;
  return <div className="bg-white rounded-xl" style={style}>{inner}</div>;
}

// ── Mini Map ──────────────────────────────────────────────────────────────────

function MiniMap({ zones }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);

  useEffect(() => {
    const hasZonesWithPaths = zones.some(z => z.paths?.length);
    if (!MAPBOX_TOKEN || !containerRef.current || !hasZonesWithPaths) return;

    // Destroy previous map if zones updated
    if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }

    function loadLink(href, id) {
      if (document.getElementById(id)) return;
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = href;
      document.head.appendChild(l);
    }
    function injectScript(src, id, windowKey, onReady) {
      if (window[windowKey]) { onReady(); return; }
      const existing = document.getElementById(id);
      if (existing) { existing.addEventListener("load", onReady, { once: true }); return; }
      const s = document.createElement("script"); s.id = id; s.src = src; s.async = true;
      s.addEventListener("load", onReady, { once: true });
      document.head.appendChild(s);
    }

    let cancelled = false;
    loadLink("https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css", "mapbox-css");
    injectScript("https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js", "mapbox-js", "mapboxgl", () => {
      if (cancelled || !containerRef.current) return;
      if (!window.mapboxgl?.supported?.()) return;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current) return;
        let map;
        try {
          map = new window.mapboxgl.Map({
            container: containerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            interactive: false,
            attributionControl: false,
          });
        } catch { return; }
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) { try { map.remove(); } catch {} mapRef.current = null; return; }
          const allCoords = [];
          zones.forEach(zone => {
            if (!zone.paths?.length) return;
            const zoneColor = zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6");
            const isActive  = zone.type !== "exclude" && (zone.todayShootCount || 0) > 0;
            const coords = [...zone.paths.map(p => [p.lng, p.lat]), [zone.paths[0].lng, zone.paths[0].lat]];
            coords.slice(0, -1).forEach(c => allCoords.push(c));
            const srcId = `zm-${zone.id}`;
            try {
              map.addSource(srcId, { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } } });
              map.addLayer({ id: `${srcId}-fill`, type: "fill", source: srcId, paint: { "fill-color": zoneColor, "fill-opacity": zone.type === "exclude" ? 0.12 : isActive ? 0.28 : 0.08 } });
              map.addLayer({ id: `${srcId}-line`, type: "line", source: srcId, paint: {
                "line-color": zoneColor, "line-width": 1.6,
                "line-dasharray": (zone.type === "exclude" || !isActive) ? [3, 2] : [1, 0],
              }});
            } catch {}
          });
          if (allCoords.length >= 2) {
            try {
              const bounds = allCoords.reduce((b, c) => b.extend(c), new window.mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
              map.fitBounds(bounds, { padding: 20, maxZoom: 13, animate: false });
            } catch {}
          }
        });
      });
    });

    return () => { cancelled = true; if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; } };
  }, [zones]);

  if (!MAPBOX_TOKEN) return null;
  const hasZonesWithPaths = zones.some(z => z.paths?.length);
  if (!hasZonesWithPaths) return null;
  return <div ref={containerRef} className="h-40 rounded-lg overflow-hidden" style={{ border: "1px solid #E9ECF0", minHeight: 0 }} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const [listings,         setListings]         = useState([]);
  const [tenant,           setTenant]           = useState(null);
  const [hasProducts,      setHasProducts]      = useState(false);
  const [pendingRevisions, setPendingRevisions] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [linkCopied,       setLinkCopied]       = useState(false);
  const [dismissingGuide,  setDismissingGuide]  = useState(false);
  const [teamMembers,      setTeamMembers]      = useState([]);
  const [zones,            setZones]            = useState([]);
  const [todayScope,       setTodayScope]       = useState("today");
  const [groupMode,        setGroupMode]        = useState("photographer");
  const [setupOpen,        setSetupOpen]        = useState(null); // null = use default logic

  const { permissions, userRole: ctxRole } = useDashboardPermissions();
  const isOwnerOrAdmin    = ctxRole === "owner" || ctxRole === "admin" || ctxRole === null;
  const canCreateBookings = isOwnerOrAdmin || !!permissions?.canCreateBookings;
  const canViewListings   = isOwnerOrAdmin || !!permissions?.canViewListings;
  const canViewRevenue    = isOwnerOrAdmin || !!permissions?.canViewRevenue;

  // Init localStorage prefs on mount
  useEffect(() => {
    const groupPref = localStorage.getItem("kyoria_dash_today_group");
    if (groupPref) setGroupMode(groupPref);
    const setupPref = localStorage.getItem("kyoria_dash_setup_open");
    if (setupPref !== null) setSetupOpen(setupPref === "true");
  }, []);

  async function loadAll() {
    if (isDemo()) {
      const d = getDemoDashboard();
      setTenant(d.tenant);
      setHasProducts(true);
      setListings(d.listings);
      setTeamMembers(d.team);
      setZones(d.zones);
      setPendingRevisions(d.revisions);
      setLoading(false);
      return;
    }
    const result = await auth.currentUser?.getIdTokenResult(true);
    if (!result) return;
    const token = result.token;
    const h = { Authorization: `Bearer ${token}` };
    const [listRes, tenantRes, svcRes, pkgRes, revRes, teamRes, zonesRes] = await Promise.all([
      fetch("/api/dashboard/listings",                 { headers: h }),
      fetch("/api/dashboard/tenant",                   { headers: h }),
      fetch("/api/dashboard/products?type=services",   { headers: h }),
      fetch("/api/dashboard/products?type=packages",   { headers: h }),
      fetch("/api/dashboard/revisions?status=pending", { headers: h }),
      fetch("/api/dashboard/team",                     { headers: h }),
      fetch("/api/dashboard/service-areas",            { headers: h }),
    ]);
    const listData  = listRes.ok  ? await listRes.json()   : {};
    const tenantData= tenantRes.ok? await tenantRes.json() : {};
    const revData   = revRes.ok   ? await revRes.json()    : {};
    const teamData  = teamRes.ok  ? await teamRes.json()   : {};
    const zonesData = zonesRes.ok ? await zonesRes.json()  : {};
    const svcData   = svcRes.ok   ? await svcRes.json()    : {};
    const pkgData   = pkgRes.ok   ? await pkgRes.json()    : {};

    const realListings = listData.listings || [];
    const realTeam     = teamData.members  || [];
    const realZones    = zonesData.zones   || [];

    setTenant(tenantData.tenant || null);
    setHasProducts((svcData.items?.length || 0) > 0 || (pkgData.items?.length || 0) > 0);

    setListings(realListings);
    setTeamMembers(realTeam);
    setZones(realZones);
    setPendingRevisions(revData.revisions || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Refetch silently when the tab regains focus (picks up team/listing changes made in other tabs)
  useEffect(() => {
    function onFocus() { if (!document.hidden) loadAll(); }
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, []);

  // Date helpers — use LOCAL date, not UTC, so "today" matches regardless of timezone
  const todayStr    = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const tomorrowStr = useMemo(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const nowWeek     = useMemo(() => isoWeek(todayStr), [todayStr]);

  // Listings filtered by scope — hidden bookings excluded from live view
  const scopeListings = useMemo(() => listings.filter(l => {
    if (l.hidden || l.status === "cancelled" || !l.shootDate) return false;
    if (todayScope === "today")    return l.shootDate === todayStr;
    if (todayScope === "tomorrow") return l.shootDate === tomorrowStr;
    const w = isoWeek(l.shootDate);
    return w.y === nowWeek.y && w.w === nowWeek.w;
  }), [listings, todayScope, todayStr, tomorrowStr, nowWeek]);

  // KPIs — hidden bookings excluded from all counts
  const todayCount = useMemo(
    () => listings.filter(l => !l.hidden && l.shootDate === todayStr && l.status !== "cancelled").length,
    [listings, todayStr]
  );
  const activeCount = useMemo(
    () => listings.filter(l => !l.hidden && ACTIVE_STAGES.includes(resolveWorkflowStatus(l))).length,
    [listings]
  );
  const thisWeekRev = useMemo(
    () => listings.filter(l => !l.hidden && (l.shootDate || l.preferredDate)).filter(l => { const d = l.shootDate || l.preferredDate; const w = isoWeek(d); return w.y === nowWeek.y && w.w === nowWeek.w; }).reduce((s, l) => s + (l.totalPrice || 0), 0),
    [listings, nowWeek]
  );
  const prevWeekRev = useMemo(() => {
    const pw = new Date(Date.now() - 7 * 86400000); const prev = isoWeek(`${pw.getFullYear()}-${String(pw.getMonth()+1).padStart(2,'0')}-${String(pw.getDate()).padStart(2,'0')}`);
    return listings.filter(l => !l.hidden && (l.shootDate || l.preferredDate)).filter(l => { const d = l.shootDate || l.preferredDate; const w = isoWeek(d); return w.y === prev.y && w.w === prev.w; }).reduce((s, l) => s + (l.totalPrice || 0), 0);
  }, [listings]);
  const weekDelta = prevWeekRev > 0 ? Math.round(((thisWeekRev - prevWeekRev) / prevWeekRev) * 100) : null;
  const avgTurnaround = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const eligible = listings.filter(l => l.shootDate && l.deliveredAt && new Date(l.deliveredAt) >= cutoff);
    if (!eligible.length) return null;
    return Math.round(eligible.reduce((s, l) => s + (new Date(l.deliveredAt) - new Date(l.shootDate + "T12:00:00")) / 3600000, 0) / eligible.length);
  }, [listings]);

  // Action items
  const actionItems = useMemo(() => [
    ...pendingRevisions.map(r => ({
      type: "revision_request", id: r.id,
      label: r.agentName || r.agentEmail || "Client",
      detail: r.message ? (r.message.length > 55 ? r.message.slice(0, 55) + "…" : r.message) : "Revision requested",
      href: r.bookingId ? `/dashboard/listings/${r.bookingId}` : `/dashboard/revisions`,
      urgency: "high",
    })),
    ...listings.filter(l => !l.hidden && l.status === "requested" && !l.depositPaid)
      .map(l => ({ type: "booking_request", id: l.id, label: l.clientName, detail: l.address?.split(",")[0], href: `/dashboard/listings/${l.id}`, urgency: "high" })),
    ...listings.filter(l => !l.hidden && l.depositPaid && !l.balancePaid && !(l.paidInFull) && resolveWorkflowStatus(l) === "delivered")
      .map(l => ({ type: "balance_due", id: l.id, label: l.clientName, detail: `Balance $${((l.totalPrice || 0) - (l.depositAmount || 0)).toLocaleString()}`, href: `/dashboard/listings/${l.id}`, urgency: "medium" })),
    ...listings.filter(l => !l.hidden && ACTIVE_STAGES.includes(resolveWorkflowStatus(l)) && !l.shootDate && !l.preferredDate)
      .map(l => ({ type: "no_date", id: l.id, label: l.clientName, detail: l.address?.split(",")[0], href: `/dashboard/listings/${l.id}`, urgency: "medium" })),
  ].slice(0, 8), [pendingRevisions, listings]);

  // Visible action items (gates balance_due by canViewRevenue)
  const visibleActionItems = useMemo(
    () => actionItems.filter(i => canViewRevenue || i.type !== "balance_due"),
    [actionItems, canViewRevenue]
  );

  // Map each photographer to their primary assigned zone (oldest zone wins to avoid drift)
  const photographerZoneMap = useMemo(() => {
    const map = {};
    [...zones].reverse().forEach(z => {
      (z.assignedTo || []).forEach(phId => { map[phId] = z.id; });
    });
    return map;
  }, [zones]);

  // Team enriched with scope status
  const teamWithStatus = useMemo(() => teamMembers.map(m => {
    const shoots = scopeListings.filter(l => l.photographerId === m.id);
    const zoneId = shoots[0]?.zoneId || photographerZoneMap[m.id] || null;
    const zone   = zoneId ? zones.find(z => z.id === zoneId) : null;
    const times  = shoots.filter(l => l.shootTime).map(l => l.shootTime).sort();
    return {
      ...m,
      workingToday:    shoots.length > 0,
      todayShootCount: shoots.length,
      primaryZone:     zone ? { id: zone.id, name: zone.name, color: zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6") } : null,
      hoursToday:      times.length ? `${times[0]} – ${times[times.length - 1]}` : null,
    };
  }).sort((a, b) => Number(b.workingToday) - Number(a.workingToday)), [teamMembers, scopeListings, zones, photographerZoneMap]);

  // Zones enriched with scope shoot counts — only exact zoneId matches to avoid misattribution
  const zonesWithStatus = useMemo(() => zones.map(z => {
    const zoneShots = scopeListings.filter(l => l.zoneId === z.id);
    const names     = [...new Set(zoneShots.map(l => l.photographerName).filter(Boolean))];
    return { ...z, todayShootCount: zoneShots.length, todayPhotographerNames: names };
  }).sort((a, b) => b.todayShootCount - a.todayShootCount || (a.name || "").localeCompare(b.name || "")), [zones, scopeListings]);

  const activeZoneCount  = useMemo(() => zonesWithStatus.filter(z => z.type !== "exclude" && z.todayShootCount > 0).length, [zonesWithStatus]);
  const totalZoneCount   = useMemo(() => zonesWithStatus.filter(z => z.type === "include").length, [zonesWithStatus]);
  const workingPhotogCnt = useMemo(() => new Set(scopeListings.map(l => l.photographerId).filter(Boolean)).size, [scopeListings]);

  // Photographer groups for Today snapshot
  const photographerGroups = useMemo(() => {
    const grouped = {};
    scopeListings.filter(l => l.photographerId).forEach(l => {
      if (!grouped[l.photographerId]) {
        const ph = teamMembers.find(m => m.id === l.photographerId);
        grouped[l.photographerId] = {
          photographerId:   l.photographerId,
          photographerName: l.photographerName || ph?.name || "Unassigned",
          phColor:          ph?.color || avatarColor(l.photographerName || ""),
          zone:             zones.find(z => z.id === (l.zoneId || photographerZoneMap[l.photographerId])),
          shoots:           [],
          dayTotal:         0,
        };
      }
      grouped[l.photographerId].shoots.push(l);
      grouped[l.photographerId].dayTotal += paidAmount(l);
    });
    return Object.values(grouped)
      .map(g => ({ ...g, shoots: g.shoots.slice().sort((a, b) => (a.shootTime || "").localeCompare(b.shootTime || "")) }))
      .sort((a, b) => (a.shoots[0]?.shootTime || "99:99").localeCompare(b.shoots[0]?.shootTime || "99:99"));
  }, [scopeListings, teamMembers, zones, photographerZoneMap]);

  // Starter guide steps — sequential: each step unlocks only after the previous is done
  const isSoloTenant = getEffectivePlan(tenant) === "solo";
  const starterSteps = tenant ? [
    { id: "booking",     num: 1, done: !!((tenant.bookingConfig && Object.keys(tenant.bookingConfig).length > 0) || (tenant.pricingConfig && Object.keys(tenant.pricingConfig).length > 0)), label: "Booking settings",  desc: "Set your availability, time slots, and booking policies", href: "/dashboard/settings#settings-booking" },
    { id: "serviceArea", num: 2, done: zones.length > 0,                                                              label: "Service area",       desc: "Draw the zones where you accept shoots",                  href: "/dashboard/service-areas" },
    { id: "products",    num: 3, done: hasProducts,                                                                   label: "Add services",       desc: "Create the packages and add-ons clients can book",        href: "/dashboard/products" },
    { id: "team",        num: 4, done: isSoloTenant || teamMembers.length > 0,                                        label: "Add team members",   desc: isSoloTenant ? "Upgrade to Studio to add teammates" : "Invite photographers, editors, and managers", href: isSoloTenant ? "/dashboard/billing" : "/dashboard/team", isSoloPlan: isSoloTenant },
  ] : [];
  const starterDone      = starterSteps.filter(s => s.done).length;
  const starterComplete  = starterDone === starterSteps.length;
  const showStarterGuide = isOwnerOrAdmin && tenant?.onboardingCompleted && !tenant?.starterGuideCompleted && !starterComplete;
  const showSetupBanner  = isOwnerOrAdmin && tenant && !tenant.onboardingCompleted;

  // Collapse setup guide when >= 3 steps done; user toggle overrides
  const isSetupCollapsed = setupOpen !== null ? !setupOpen : starterDone >= 3;
  const nextStep         = starterSteps.find(s => !s.done);

  function toggleSetup() {
    const newOpen = isSetupCollapsed;
    setSetupOpen(newOpen);
    localStorage.setItem("kyoria_dash_setup_open", String(newOpen));
  }
  function persistGroupMode(mode) {
    setGroupMode(mode);
    localStorage.setItem("kyoria_dash_today_group", mode);
  }

  async function dismissStarterGuide() {
    setDismissingGuide(true);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ starterGuideCompleted: true }),
      });
      setTenant(t => ({ ...t, starterGuideCompleted: true }));
    } catch {}
    setDismissingGuide(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#1B4BB8] rounded-full animate-spin" />
    </div>
  );

  const today    = new Date();
  const hour     = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (tenant?.businessName || "").split(" ")[0] || "";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Ops subhead parts (only non-zero)
  const opsParts = [
    todayCount > 0      && `${todayCount} shoot${todayCount !== 1 ? "s" : ""} today`,
    workingPhotogCnt > 0 && `${workingPhotogCnt} photographer${workingPhotogCnt !== 1 ? "s" : ""}`,
    activeZoneCount > 0  && `${activeZoneCount} zone${activeZoneCount !== 1 ? "s" : ""} live`,
  ].filter(Boolean);

  const bookingUrl = tenant ? `${getAppUrl()}/${tenant.slug}/book` : "";

  function copyLink() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  const scopeLabel = { today: "Today", tomorrow: "Tomorrow", week: "This week" }[todayScope];

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA" }}>
      <div className="max-w-[1300px] mx-auto px-6 py-8 space-y-5">

        {/* ── Stripe banner ─────────────────────────────────────────────── */}
        {isOwnerOrAdmin && tenant?.onboardingCompleted && !tenant.stripeConnectOnboarded && (
          <div className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 bg-white" style={{ border: "1px solid #FDE68A" }}>
            <div className="flex items-center gap-3">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Connect Stripe to accept payments</p>
                <p className="text-xs text-gray-400 mt-0.5">Deposits won't be collected until Stripe Connect is active.</p>
              </div>
            </div>
            <Link href="/dashboard/billing" className="flex-shrink-0 text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 px-3.5 py-2 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">
              Connect Stripe →
            </Link>
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "#0F172A" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[14px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: "#6B7280" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ background: "#9CA3AF" }} />
              {dateLabel}
              {opsParts.length > 0 && <span className="text-gray-300">·</span>}
              {opsParts.join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canCreateBookings && bookingUrl && (
              <button onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-[14px] font-medium px-3.5 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #E9ECF0", background: "#fff", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#C7D2E8"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#E9ECF0"}>
                {linkCopied ? "✓ Copied" : "Copy Booking Link"}
              </button>
            )}
            {canCreateBookings && bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium px-3.5 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #E9ECF0", background: "#fff", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#C7D2E8"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#E9ECF0"}>
                Booking Page ↗
              </a>
            )}
            {canViewListings && (
              <Link href="/dashboard/bookings/create"
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
                style={{ background: "#3486cf" }}
                onMouseEnter={e => e.currentTarget.style.background = "#2a6dab"}
                onMouseLeave={e => e.currentTarget.style.background = "#3486cf"}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Listing
              </Link>
            )}
          </div>
        </div>

        {/* ── Onboarding banner ─────────────────────────────────────────── */}
        {showSetupBanner && (
          <div className="rounded-xl px-5 py-4 flex items-center justify-between gap-4 bg-white" style={{ border: "1px solid #BFDBFE" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Finish setting up your account</p>
                <p className="text-xs text-gray-400 mt-0.5">Add your branding, connect Stripe, and configure your service areas.</p>
              </div>
            </div>
            <Link href="/onboarding" className="flex-shrink-0 text-xs font-semibold text-[#3486cf] border border-[#3486cf]/20 bg-blue-50 px-3.5 py-2 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap">
              Continue Setup →
            </Link>
          </div>
        )}

        {/* ── Starter Guide (collapsible) ───────────────────────────────── */}
        {showStarterGuide && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
            <button onClick={toggleSetup}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              style={{ borderBottom: isSetupCollapsed ? "none" : "1px solid #E9ECF0" }}>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="text-[14px] font-semibold whitespace-nowrap" style={{ color: "#0F172A" }}>
                  Workspace setup · {starterDone} of {starterSteps.length} complete
                </span>
                {nextStep && isSetupCollapsed && (
                  <Link href={nextStep.href} onClick={e => e.stopPropagation()}
                    className="text-[14px] font-semibold text-[#3486cf] hover:underline whitespace-nowrap hidden sm:block">
                    {nextStep.label} →
                  </Link>
                )}
              </div>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${starterSteps.length ? Math.round((starterDone / starterSteps.length) * 100) : 0}%`, background: "#3486cf" }} />
              </div>
              <span className="text-gray-400 text-xs flex-shrink-0">{isSetupCollapsed ? "▾" : "▴"}</span>
            </button>

            {!isSetupCollapsed && (
              <>
                <div>
                  {starterSteps.map((step, i) => {
                    const prevDone = i === 0 || starterSteps[i - 1].done;
                    const locked   = !prevDone;
                    return (
                      <div key={step.id} className="flex items-center gap-4 px-6 py-4"
                        style={{ borderBottom: i < starterSteps.length - 1 ? "1px solid #F3F4F6" : "none", opacity: locked ? 0.4 : 1, transition: "opacity 0.2s" }}>
                        <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${step.done ? "bg-[#3486cf]" : locked ? "bg-gray-100 border border-gray-200" : "border-2 border-gray-200"}`}>
                          {step.done ? (
                            <svg width="10" height="10" fill="none" viewBox="0 0 12 12">
                              <path d="M2.5 6L5 8.5 9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <span className="text-[9px] font-bold" style={{ color: locked ? "#D1D5DB" : "#9CA3AF" }}>{step.num}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[14px] block font-medium ${step.done ? "line-through decoration-gray-300" : ""}`}
                            style={{ color: step.done ? "#9CA3AF" : "#374151" }}>
                            {step.label}
                            {step.isSoloPlan && (
                              <span className="ml-2 text-[10px] font-semibold bg-blue-50 text-[#3486cf] px-1.5 py-0.5 rounded-full align-middle">Solo plan</span>
                            )}
                          </span>
                          {!step.done && <span className="text-[14px]" style={{ color: "#9CA3AF" }}>{step.desc}</span>}
                        </div>
                        {!step.done && !locked && step.href && (
                          <Link href={step.href} className="text-xs font-semibold text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap flex-shrink-0">
                            Go to →
                          </Link>
                        )}
                        {step.done && <span className="text-[14px] text-gray-300 font-medium flex-shrink-0">Done</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="px-6 py-3 flex justify-end" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <button onClick={dismissStarterGuide} disabled={dismissingGuide}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    {dismissingGuide ? "…" : "Dismiss"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── KPI strip (5 cards) ───────────────────────────────────────── */}
        <div className={`grid gap-3 grid-cols-2 ${canViewRevenue ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-4"}`}>
          <KpiCard label="Today" value={todayCount} sub="shoots scheduled" href="/dashboard/team?date=today" />
          <KpiCard label="Active Listings" value={activeCount} sub="in production" href="/dashboard/listings?view=active" />
          <KpiCard
            label="Needs Action"
            value={visibleActionItems.length}
            sub="revisions + balances"
            dot={visibleActionItems.length > 0 ? "#DC2626" : undefined}
            anchorId="action-required"
          />
          {canViewRevenue && (
            <KpiCard
              label="This Week"
              value={`$${thisWeekRev.toLocaleString()}`}
              sub={weekDelta !== null ? `${weekDelta >= 0 ? "↑" : "↓"} ${Math.abs(weekDelta)}% vs prev` : "booked revenue"}
              dot={weekDelta !== null ? (weekDelta >= 0 ? "#1F8A5B" : "#DC2626") : undefined}
              href="/dashboard/reports?period=7d"
            />
          )}
          <KpiCard
            label="Avg Turnaround"
            value={avgTurnaround !== null ? `${avgTurnaround}h` : "—"}
            sub="delivery time"
            href="/dashboard/reports?metric=turnaround"
          />
        </div>

        {/* ── Today snapshot ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>

          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px dashed #E9ECF0" }}>
            <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Today</h2>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#EEF5FC", color: "#1E5A8A" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#3486cf" }} />
              Live
            </span>
            <div className="flex-1" />
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
              {[["today","Today"],["tomorrow","Tomorrow"],["week","This week"]].map(([scope, lbl]) => (
                <button key={scope} onClick={() => setTodayScope(scope)}
                  className="px-3 py-1.5 text-[14px] font-medium transition-colors"
                  style={todayScope === scope ? { background: "#3486cf", color: "#fff" } : { background: "#fff", color: "#6B7280" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Two-column body: Team + Zones */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: "1px dashed #E9ECF0" }}>

            {/* Team column (hidden when no team members) */}
            {teamMembers.length > 0 && (
              <div className="p-4 border-b md:border-b-0 md:border-r" style={{ borderColor: "#E9ECF0" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-bold uppercase tracking-[0.09em]" style={{ color: "#9CA3AF" }}>
                    Team working · {teamWithStatus.filter(m => m.workingToday).length} of {teamMembers.length}
                  </p>
                  <Link href="/dashboard/team" className="text-[14px] transition-colors" style={{ color: "#9CA3AF" }}>Manage →</Link>
                </div>
                <div className="space-y-1.5">
                  {teamWithStatus.slice(0, 5).map(m => (
                    <Link key={m.id} href={`/dashboard/team?member=${m.id}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-gray-50"
                      style={{ border: "1px solid #F3F4F6", opacity: m.workingToday ? 1 : 0.55 }}>
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: m.workingToday ? (m.color || avatarColor(m.name)) : "#E0DDD0" }}>
                        {initials(m.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-semibold truncate" style={{ color: "#0F172A" }}>{m.name}</span>
                          <span className="text-[14px] flex-shrink-0" style={{ color: "#9CA3AF" }}>· {m.role}</span>
                        </div>
                        <p className="text-[14px]" style={{ color: "#9CA3AF" }}>
                          {m.workingToday
                            ? <>{m.hoursToday || "Scheduled"}{m.primaryZone && <> · <span className="inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: m.primaryZone.color }} />{m.primaryZone.name}</span></>}</>
                            : "Off today"}
                        </p>
                      </div>
                      <span className="text-[14px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={m.workingToday ? { background: "#EEF5FC", color: "#1E5A8A" } : { background: "#F3F4F6", color: "#9CA3AF" }}>
                        {m.workingToday ? m.todayShootCount : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Zones column */}
            <div className={`p-4 ${teamMembers.length === 0 ? "md:col-span-2" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-bold uppercase tracking-[0.09em]" style={{ color: "#9CA3AF" }}>
                  Zones · {activeZoneCount} of {totalZoneCount} active
                </p>
                <Link href="/dashboard/service-areas" className="text-[14px] transition-colors" style={{ color: "#9CA3AF" }}>Manage →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MiniMap zones={zonesWithStatus} />
                <div className="space-y-1.5 overflow-x-auto sm:overflow-visible">
                  <div className="flex sm:flex-col gap-1.5 min-w-0">
                    {zonesWithStatus.slice(0, 6).map(z => {
                      const zoneColor = z.type === "exclude" ? "#EF4444" : (z.color || "#3B82F6");
                      const isActive  = z.type !== "exclude" && z.todayShootCount > 0;
                      const meta = z.type === "exclude" ? "Excluded"
                        : z.todayShootCount === 0 ? "Idle today"
                        : `${z.todayShootCount} shoot${z.todayShootCount !== 1 ? "s" : ""}${z.todayPhotographerNames[0] ? ` · ${z.todayPhotographerNames[0]}${z.todayPhotographerNames.length > 1 ? ` +${z.todayPhotographerNames.length - 1}` : ""}` : ""}`;
                      return (
                        <Link key={z.id} href={`/dashboard/service-areas?zone=${z.id}`}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-gray-50 flex-shrink-0 sm:flex-shrink"
                          style={{ border: `1px ${isActive ? "solid" : "dashed"} ${isActive ? "#EFE9D6" : "#E9ECF0"}`, background: isActive ? "#FBFAF5" : "transparent", opacity: z.type === "exclude" ? 0.85 : 1 }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: zoneColor }} />
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium truncate" style={{ color: isActive ? "#0F172A" : "#9CA3AF" }}>{z.name}</p>
                            <p className="text-[14px] whitespace-nowrap" style={{ color: z.type === "exclude" ? "#DC2626" : "#9CA3AF" }}>{meta}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Photographer-grouped shoots */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold uppercase tracking-[0.09em]" style={{ color: "#9CA3AF" }}>
                Shoots · {scopeListings.length} · {scopeLabel}
              </p>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
                {[["photographer","By photographer"],["time","By time"]].map(([mode, lbl]) => (
                  <button key={mode} onClick={() => persistGroupMode(mode)}
                    className="px-2.5 py-1 text-[14px] font-medium transition-colors"
                    style={groupMode === mode ? { background: "#3486cf", color: "#fff" } : { background: "#fff", color: "#6B7280" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {scopeListings.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-gray-50" style={{ border: "1px solid #E9ECF0" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No shoots {todayScope === "week" ? "this week" : todayScope}.</p>
                <Link href="/dashboard/bookings/create" className="text-xs text-[#3486cf] mt-1 inline-block hover:underline">Add a booking →</Link>
              </div>

            ) : groupMode === "photographer" ? (
              <div className="space-y-3">
                {photographerGroups.map(g => {
                  const phColor   = g.phColor;
                  const zoneColor = g.zone ? (g.zone.type === "exclude" ? "#EF4444" : (g.zone.color || "#3B82F6")) : phColor;
                  return (
                    <div key={g.photographerId} className="rounded-lg overflow-hidden" style={{ border: "1px solid #F3F4F6" }}>
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#FBFAF5]">
                        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold" style={{ background: phColor }}>
                          {initials(g.photographerName)}
                        </div>
                        <span className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>{g.photographerName}</span>
                        <span className="text-[14px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                          {g.shoots.length} shoot{g.shoots.length !== 1 ? "s" : ""}
                        </span>
                        {g.zone && (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: zoneColor }} />
                            <span className="text-[14px]" style={{ color: "#6B7280" }}>{g.zone.name}</span>
                          </div>
                        )}
                        <div className="flex-1" />
                        {canViewRevenue && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px]" style={{ color: "#9CA3AF" }}>day total</span>
                            <span className="text-[14px] font-bold" style={{ color: "#0F172A" }}>${g.dayTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      {g.shoots.map((l, si) => {
                        const pay = payLabel(l);
                        return (
                          <Link key={l.id} href={`/dashboard/listings/${l.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors group"
                            style={{ borderTop: "1px solid #F3F4F6" }}>
                            <span className="text-[14px] font-mono w-14 flex-shrink-0" style={{ color: "#374151", fontFamily: "monospace" }}>
                              {l.shootTime || "—"}
                            </span>
                            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: zoneColor, minHeight: 28 }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-medium truncate" style={{ color: "#0F172A" }}>{l.clientName}</span>
                                {l.selectedPackageName && (
                                  <span className="text-[14px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "#FEF9EC", color: "#92400E" }}>
                                    {l.selectedPackageName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[14px] truncate" style={{ color: "#9CA3AF" }}>
                                {l.address?.split(",")[0]}
                              </p>
                            </div>
                            {canViewRevenue && (
                              <div className="flex-shrink-0 text-right">
                                <p className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>${(l.totalPrice || 0).toLocaleString()}</p>
                                <span className="text-[14px] font-medium px-1 py-0.5 rounded" style={{ color: pay.color, background: pay.bg }}>
                                  {pay.label}
                                </span>
                              </div>
                            )}
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="2"
                              className="flex-shrink-0 group-hover:stroke-gray-400 transition-colors">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            ) : (
              // By time: flat sorted list
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #F3F4F6" }}>
                {[...scopeListings].sort((a, b) => (a.shootTime || "").localeCompare(b.shootTime || "")).map((l, idx, arr) => {
                  const zone      = zones.find(z => z.id === (l.zoneId || photographerZoneMap[l.photographerId]));
                  const lineColor = zone ? (zone.type === "exclude" ? "#EF4444" : (zone.color || "#3B82F6")) : avatarColor(l.photographerName || "");
                  const pay       = payLabel(l);
                  return (
                    <Link key={l.id} href={`/dashboard/listings/${l.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors group"
                      style={{ borderBottom: idx < arr.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                      <span className="text-[14px] w-14 flex-shrink-0" style={{ color: "#374151", fontFamily: "monospace" }}>
                        {l.shootTime || "—"}
                      </span>
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: lineColor, minHeight: 28 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium truncate" style={{ color: "#0F172A" }}>{l.clientName}</span>
                          {l.photographerName && <span className="text-[14px] text-gray-400 truncate flex-shrink-0">{l.photographerName}</span>}
                        </div>
                        <p className="text-[14px] truncate" style={{ color: "#9CA3AF" }}>{l.address?.split(",")[0]}</p>
                      </div>
                      {canViewRevenue && (
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>${(l.totalPrice || 0).toLocaleString()}</p>
                          <span className="text-[14px] font-medium" style={{ color: pay.color }}>{pay.label}</span>
                        </div>
                      )}
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="2"
                        className="flex-shrink-0 group-hover:stroke-gray-400 transition-colors">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Action Required ───────────────────────────────────────────── */}
        {visibleActionItems.length > 0 && (
          <div id="action-required" className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #FEE2E2" }}>
            <div className="px-6 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid #FEF2F2", background: "#FFF5F5" }}>
              <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-[14px] font-semibold text-red-700">Action Required</h2>
              <span className="text-[14px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{visibleActionItems.length}</span>
            </div>
            <div>
              {visibleActionItems.map((item, idx) => {
                const typeLabel = item.type === "revision_request" ? "Revision request"
                  : item.type === "booking_request" ? "New booking"
                  : item.type === "balance_due"     ? "Balance due"
                  : "No shoot date";
                const dotColor = item.urgency === "high" ? "#DC2626" : "#D97706";
                return (
                  <Link key={`${item.type}-${item.id}`} href={item.href}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                    style={{ borderBottom: idx < visibleActionItems.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-gray-800 truncate">{item.label}</p>
                      <p className="text-[14px] text-gray-400 truncate">{item.detail}</p>
                    </div>
                    <span className="text-[13px] font-medium text-gray-400 flex-shrink-0">{typeLabel}</span>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="2"
                      className="flex-shrink-0 group-hover:stroke-[#9CA3AF] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
