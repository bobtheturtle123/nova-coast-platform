"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { calculateTenantPrice, getSqftTier, getItemPrice, getFromPrice, formatPrice } from "@/lib/catalogUtils";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { getPlan } from "@/lib/plans";
import WeatherWidget from "@/components/dashboard/WeatherWidget";

const TIME_SLOTS = [
  { label: "7:00 AM",  value: "07:00" }, { label: "7:30 AM",  value: "07:30" },
  { label: "8:00 AM",  value: "08:00" }, { label: "8:30 AM",  value: "08:30" },
  { label: "9:00 AM",  value: "09:00" }, { label: "9:30 AM",  value: "09:30" },
  { label: "10:00 AM", value: "10:00" }, { label: "10:30 AM", value: "10:30" },
  { label: "11:00 AM", value: "11:00" }, { label: "11:30 AM", value: "11:30" },
  { label: "12:00 PM", value: "12:00" }, { label: "12:30 PM", value: "12:30" },
  { label: "1:00 PM",  value: "13:00" }, { label: "1:30 PM",  value: "13:30" },
  { label: "2:00 PM",  value: "14:00" }, { label: "2:30 PM",  value: "14:30" },
  { label: "3:00 PM",  value: "15:00" }, { label: "3:30 PM",  value: "15:30" },
  { label: "4:00 PM",  value: "16:00" }, { label: "4:30 PM",  value: "16:30" },
  { label: "5:00 PM",  value: "17:00" }, { label: "5:30 PM",  value: "17:30" },
  { label: "6:00 PM",  value: "18:00" }, { label: "6:30 PM",  value: "18:30" },
  { label: "7:00 PM",  value: "19:00" }, { label: "7:30 PM",  value: "19:30" },
];

const DURATION_PRESETS = [
  { label: "30 min", value: 30  },
  { label: "1 hr",   value: 60  },
  { label: "1.5 hr", value: 90  },
  { label: "2 hr",   value: 120 },
  { label: "2.5 hr", value: 150 },
  { label: "3 hr",   value: 180 },
  { label: "4 hr",   value: 240 },
];

const SPECIAL_VALUES = new Set(["golden-hour", "sunset", "twilight"]);

function AutocompleteInput({ value, onChange, onSelect, suggestions, placeholder, type = "text", label, required, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes((value || "").toLowerCase())
  ).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      {label && <label className="label-field">{label}{required && " *"}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        className={className || "input-field w-full"}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <li key={i}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
              className="px-3 py-2 text-sm hover:bg-[#3486cf]/5 cursor-pointer text-[#0F172A]">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// mode: "create" | "edit"
// bookingId: string (required when mode === "edit")
// initialValues: booking object (prefills form in edit mode)
// onSuccess: (bookingId: string) => void (called after save; if omitted, router.push is used)
export default function BookingForm({ mode = "create", bookingId, initialValues, onSuccess }) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const init   = initialValues || {};

  const [form, setForm] = useState({
    clientName:              init.clientName              || "",
    clientEmail:             init.clientEmail             || "",
    clientPhone:             init.clientPhone             || "",
    address:                 init.address                 || "",
    unit:                    init.unit                    || "",
    city:                    init.city                    || "",
    state:                   init.state                   || "CA",
    zip:                     init.zip                     || "",
    lat:                     init.lat                     ?? null,
    lng:                     init.lng                     ?? null,
    sqft:                    init.squareFootage ? String(init.squareFootage) : (init.sqft ? String(init.sqft) : ""),
    notes:                   init.notes                   || "",
    shootDate:               init.shootDate?.split?.("T")?.[0] || "",
    shootTime:               init.shootTime               || "",
    shootDuration:           init.shootDuration           ? String(init.shootDuration) : "",
    additionalAppointments:  init.additionalAppointments  || [],
    packageId:               init.packageId               || "",
    serviceIds:              init.serviceIds              || [],
    addonIds:                init.addonIds                || [],
    customLineItems:         [],
    depositPaid:             init.depositPaid             || false,
    photographerId:          init.photographerId          || "",
    photographerEmail:       init.photographerEmail       || "",
    photographerName:        init.photographerName        || "",
    photographerPhone:       init.photographerPhone       || "",
    photographerTbd:         isEdit ? (!init.photographerId && !init.photographerName) : false,
    additionalPhotographers: init.additionalPhotographers || [],
    sendNotification:        !isEdit,
    workflowStatus:          init.workflowStatus          || (isEdit ? "booked" : "booked"),
  });

  const [catalog,       setCatalog]       = useState({ packages: [], services: [], addons: [], pricingConfig: null });
  const [team,          setTeam]          = useState([]);
  const [timeBlocks,    setTimeBlocks]    = useState([]);
  const [bookings,      setBookings]      = useState([]);
  const [agents,        setAgents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [tenantPlan,    setTenantPlan]    = useState("solo");
  const [newItem,       setNewItem]       = useState({ label: "", price: "" });
  const [travelInfo,    setTravelInfo]    = useState({});
  const [travelLoading, setTravelLoading] = useState(false);
  const travelTimerRef  = useRef(null);
  const addressTimerRef = useRef(null);
  const [travelFee,         setTravelFee]         = useState(null);
  const [serviceArea,       setServiceArea]       = useState(null);
  const [showSchedulePopup,  setShowSchedulePopup]  = useState(false);
  const [apptPopupIdx,       setApptPopupIdx]       = useState(null);
  const [calYear,            setCalYear]            = useState(() => new Date().getFullYear());
  const [calMonth,           setCalMonth]           = useState(() => new Date().getMonth());
  const [aCalYear,           setACalYear]           = useState(() => new Date().getFullYear());
  const [aCalMonth,          setACalMonth]          = useState(() => new Date().getMonth());
  const [showServicesModal,  setShowServicesModal]  = useState(false);
  const [servicesSearch,     setServicesSearch]     = useState("");
  const [confirmedAddress,  setConfirmedAddress]  = useState(init.address || "");
  const [busySlots,         setBusySlots]         = useState(new Set());
  const [loadingSlots,      setLoadingSlots]      = useState(false);
  const [contractSignerName, setContractSignerName] = useState(init.contractSignerName || "");
  const [contractSigned,     setContractSigned]     = useState(!!init.contractSignerName);

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    if (apptPopupIdx !== null) {
      const appt = form.additionalAppointments?.[apptPopupIdx];
      if (appt?.date) {
        const d = new Date(appt.date + "T12:00:00");
        setACalYear(d.getFullYear());
        setACalMonth(d.getMonth());
      } else {
        const today = new Date();
        setACalYear(today.getFullYear());
        setACalMonth(today.getMonth());
      }
    }
  }, [apptPopupIdx]);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const safeFetch = (url) =>
          fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}));

        const [svc, pkg, adn, teamData, blocks, list, tenantData, agentsData] = await Promise.all([
          safeFetch("/api/dashboard/products?type=services"),
          safeFetch("/api/dashboard/products?type=packages"),
          safeFetch("/api/dashboard/products?type=addons"),
          safeFetch("/api/dashboard/team"),
          safeFetch("/api/dashboard/team/blocks"),
          safeFetch("/api/dashboard/listings"),
          safeFetch("/api/dashboard/tenant"),
          safeFetch("/api/dashboard/agents"),
        ]);
        const tenantDoc = tenantData?.tenant || {};
        setTenantPlan(tenantDoc.subscriptionPlan || "solo");
        setCatalog({
          packages:      pkg.items  || [],
          services:      svc.items  || [],
          addons:        adn.items  || [],
          pricingConfig: tenantDoc.pricingConfig || null,
          bookingConfig: tenantDoc.bookingConfig || null,
          showWeather:   tenantDoc.availability?.showWeather ?? true,
        });
        setTeam(teamData.members || []);
        setTimeBlocks(blocks.blocks || []);
        setBookings((list.listings || []).filter((b) => b.id !== bookingId));
        setAgents(agentsData.agents || []);
      } catch (err) {
        console.error("BookingForm load error:", err);
        setError("Failed to load form data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pricing = useMemo(() => {
    const sqft = Number(form.sqft) || 0;
    const base = calculateTenantPrice(
      form.packageId || null, form.serviceIds, form.addonIds, 0, catalog, sqft,
    );
    const customTotal = form.customLineItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
    return { ...base, customTotal, total: base.subtotal + customTotal };
  }, [form.packageId, form.serviceIds, form.addonIds, form.sqft, form.customLineItems, catalog]);

  const computedDuration = useMemo(() => {
    const sqftTier = getSqftTier(Number(form.sqft) || 0, catalog.pricingConfig);
    function itemDuration(item) {
      if (!item) return 0;
      if (item.durationTiers && sqftTier && item.durationTiers[sqftTier] != null) return item.durationTiers[sqftTier];
      return item.duration || 0;
    }
    if (form.packageId) {
      const pkg = catalog.packages.find((p) => p.id === form.packageId);
      if (!pkg) return 0;
      // Use package's own tiered/flat duration if set
      const pkgDur = itemDuration(pkg);
      if (pkgDur > 0) return pkgDur;
      // Fall back to summing included services
      if (pkg.includes?.length) {
        return pkg.includes.reduce((sum, svcId) => {
          const svc = catalog.services.find((s) => s.id === svcId);
          return sum + itemDuration(svc);
        }, 0);
      }
      return 0;
    }
    return form.serviceIds.reduce((sum, id) => {
      const svc = catalog.services.find((s) => s.id === id);
      return sum + itemDuration(svc);
    }, 0);
  }, [form.packageId, form.serviceIds, form.sqft, catalog]);

  const effectiveDuration = form.shootDuration !== "" ? Number(form.shootDuration) : computedDuration;

  const shootEndTime = useMemo(() => {
    if (!form.shootTime || SPECIAL_VALUES.has(form.shootTime) || !effectiveDuration) return null;
    const [h, m] = form.shootTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const totalMin = h * 60 + m + effectiveDuration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const suffix = endH >= 12 ? "PM" : "AM";
    const h12 = endH % 12 || 12;
    return `${h12}:${String(endM).padStart(2, "0")} ${suffix}`;
  }, [form.shootTime, effectiveDuration]);

  const durationAwareSlots = catalog?.bookingConfig?.availability?.durationAwareSlots ?? true;

  // Expand busy slots to account for full service duration.
  // A slot is unavailable if any slot within [slot, slot + duration) is busy or doesn't exist.
  const unavailableSlots = useMemo(() => {
    if (!durationAwareSlots) return busySlots;
    const slotsNeeded = effectiveDuration > 0 ? Math.ceil(effectiveDuration / 30) : 1;
    if (slotsNeeded <= 1) return busySlots;
    const result = new Set(busySlots);
    TIME_SLOTS.forEach((slot, idx) => {
      if (result.has(slot.value)) return;
      for (let i = 1; i < slotsNeeded; i++) {
        const next = TIME_SLOTS[idx + i];
        if (!next || busySlots.has(next.value)) { result.add(slot.value); break; }
      }
    });
    return result;
  }, [busySlots, effectiveDuration, durationAwareSlots]);

  const availability = useMemo(() => {
    if (!form.shootDate) return {};
    const dayStr = form.shootDate;
    const selectedServiceIds = form.packageId ? [form.packageId] : form.serviceIds;
    return team.reduce((acc, m) => {
      const blocked = timeBlocks.some((b) => {
        const startStr = (b.startDate || "").slice(0, 10);
        const endStr   = (b.endDate   || "").slice(0, 10);
        return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === m.id);
      });
      const booked = bookings.some((b) => {
        if (!b.shootDate) return false;
        const bDateStr = typeof b.shootDate === "string" ? b.shootDate.slice(0, 10) : null;
        return bDateStr === dayStr &&
          (b.photographerId === m.id || (b.photographerEmail && b.photographerEmail === m.email));
      });
      let cantPerform = false;
      if (selectedServiceIds.length > 0 && m.skills?.length > 0) {
        const skillSet = new Set(m.skills.map(String));
        cantPerform = !selectedServiceIds.every((id) => skillSet.has(String(id)));
      }
      const travelConflict = travelInfo[m.id]?.conflict === true;
      acc[m.id] = blocked ? "blocked"
        : booked && travelConflict ? "travel_conflict"
        : booked ? "booked"
        : cantPerform ? "cant_perform"
        : "available";
      return acc;
    }, {});
  }, [form.shootDate, form.packageId, form.serviceIds, team, timeBlocks, bookings, travelInfo]);

  useEffect(() => {
    if (travelTimerRef.current) clearTimeout(travelTimerRef.current);
    if (!form.shootDate || (!form.lat && !form.address)) { setTravelInfo({}); return; }
    travelTimerRef.current = setTimeout(async () => {
      const dayStr = form.shootDate;
      const conflicts = [];
      for (const member of team) {
        const sameDayBookings = bookings.filter((b) => {
          const bDateStr = typeof b.shootDate === "string" ? b.shootDate.slice(0, 10) : null;
          return bDateStr === dayStr &&
            (b.photographerId === member.id || b.photographerEmail === member.email) &&
            (b.fullAddress || b.address);
        });
        if (sameDayBookings.length === 0) continue;
        for (const existing of sameDayBookings) {
          const existingAddr = existing.fullAddress || existing.address;
          conflicts.push({ memberId: member.id, memberName: member.name, existingBookingId: existing.id, existingAddr, existingTime: existing.shootDate });
        }
      }
      if (conflicts.length === 0) { setTravelInfo({}); return; }
      setTravelLoading(true);
      try {
        const token = await getToken();
        const newAddr = form.lat && form.lng ? { lat: form.lat, lng: form.lng } : form.address;
        const res = await fetch("/api/dashboard/travel-time", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ origins: conflicts.map((c) => c.existingAddr), destinations: [newAddr] }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const newTravelInfo = {};
        conflicts.forEach((c, i) => {
          const el = data.rows?.[i]?.elements?.[0];
          if (!el || el.status !== "OK") return;
          const SHOOT_MIN = effectiveDuration || 120;
          let conflict = false;
          if (form.shootTime && c.existingTime) {
            const existingD = new Date(c.existingTime.length === 10 ? c.existingTime + "T12:00:00" : c.existingTime);
            const newD      = new Date(`${form.shootDate}T${form.shootTime}`);
            const gapMin    = Math.abs(newD - existingD) / 60000;
            conflict = gapMin < SHOOT_MIN + el.durationMinutes;
          }
          const prev = newTravelInfo[c.memberId];
          if (!prev || el.durationMinutes > prev.durationMinutes) {
            newTravelInfo[c.memberId] = { durationMinutes: el.durationMinutes, durationText: el.durationText, distanceText: el.distanceText, fromAddress: c.existingAddr, conflict };
          }
        });
        setTravelInfo(newTravelInfo);
      } catch { /* non-critical */ } finally { setTravelLoading(false); }
    }, 800);
    return () => { if (travelTimerRef.current) clearTimeout(travelTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shootDate, form.lat, form.lng, form.address, form.shootTime]);

  // Fetch busy slots for selected photographer + date
  useEffect(() => {
    const pid  = form.photographerId;
    const date = form.shootDate;
    if (!pid || pid === "owner" || !date) { setBusySlots(new Set()); return; }
    let cancelled = false;
    setLoadingSlots(true);
    getToken().then((tok) =>
      fetch(`/api/dashboard/team/${pid}/availability?date=${date}`, {
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => (r.ok ? r.json() : { busy: [] }))
    ).then((data) => {
      if (cancelled) return;
      const busy = new Set();
      const ranges = data.busy || [];
      TIME_SLOTS.forEach(({ value }) => {
        const [h, m] = value.split(":").map(Number);
        const slotStart = h * 60 + m;
        const slotEnd   = slotStart + 30;
        if (ranges.some(({ start, end }) => {
          const rs = start.split(":").map(Number); const re = end.split(":").map(Number);
          return slotStart < re[0] * 60 + re[1] && slotEnd > rs[0] * 60 + rs[1];
        })) busy.add(value);
      });
      setBusySlots(busy);
    }).catch(() => { if (!cancelled) setBusySlots(new Set()); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.photographerId, form.shootDate]);

  useEffect(() => {
    if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    if (!form.address || (!form.lat && !form.lng)) { setTravelFee(null); setServiceArea(null); return; }
    addressTimerRef.current = setTimeout(async () => {
      const token = await getToken();
      const body  = { address: form.address, lat: form.lat, lng: form.lng };
      const [feeRes, areaRes] = await Promise.all([
        fetch("/api/dashboard/travel-fee",         { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }),
        fetch("/api/dashboard/check-service-area", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ address: form.address, lat: form.lat, lng: form.lng }) }),
      ]);
      if (feeRes.ok)  setTravelFee(await feeRes.json());
      if (areaRes.ok) setServiceArea(await areaRes.json());
    }, 600);
    return () => { if (addressTimerRef.current) clearTimeout(addressTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.lat, form.lng]);

  useEffect(() => {
    if (showSchedulePopup) {
      const d = form.shootDate ? new Date(form.shootDate + "T12:00:00") : new Date();
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSchedulePopup]);

  function set(key) { return (e) => setForm((f) => ({ ...f, [key]: e.target.value })); }

  function fillClient(agent) {
    setForm((f) => ({
      ...f,
      clientName:  agent.name  || f.clientName,
      clientEmail: agent.email || f.clientEmail,
      clientPhone: agent.phone || f.clientPhone,
    }));
  }

  const [savingClient, setSavingClient] = useState(false);
  const [clientSaved,  setClientSaved]  = useState(false);

  const clientIsKnown = !!agents.find(
    (a) => a.email?.toLowerCase() === form.clientEmail?.toLowerCase()
  );

  async function saveNewClient() {
    if (!form.clientName || !form.clientEmail) return;
    setSavingClient(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.clientName, email: form.clientEmail, phone: form.clientPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setClientSaved(true);
        } else {
          alert(data.error || "Failed to save customer.");
        }
      } else {
        setAgents((prev) => [...prev, { id: data.agentId, name: form.clientName, email: form.clientEmail, phone: form.clientPhone }]);
        setClientSaved(true);
      }
    } catch {
      alert("Failed to save customer.");
    } finally {
      setSavingClient(false);
    }
  }

  function toggleService(id) {
    setForm((f) => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }));
  }
  function toggleAddon(id) {
    setForm((f) => ({ ...f, addonIds: f.addonIds.includes(id) ? f.addonIds.filter((x) => x !== id) : [...f.addonIds, id] }));
  }

  function assignPhotographer(member) {
    setForm((f) => ({
      ...f,
      photographerId:    member.id,
      photographerEmail: member.email || "",
      photographerName:  member.name,
      photographerPhone: member.phone || "",
      photographerTbd:   false,
    }));
  }

  function assignTbd() {
    setForm((f) => ({ ...f, photographerId: "", photographerEmail: "", photographerName: "TBD", photographerPhone: "", photographerTbd: true }));
  }

  function toggleAdditional(member) {
    setForm((f) => {
      const already = f.additionalPhotographers.some((p) => p.id === member.id);
      return {
        ...f,
        additionalPhotographers: already
          ? f.additionalPhotographers.filter((p) => p.id !== member.id)
          : [...f.additionalPhotographers, { id: member.id, name: member.name, email: member.email || "", phone: member.phone || "" }],
      };
    });
  }

  function addCustomItem() {
    if (!newItem.label.trim()) return;
    setForm((f) => ({ ...f, customLineItems: [...f.customLineItems, { label: newItem.label.trim(), price: Number(newItem.price) || 0 }] }));
    setNewItem({ label: "", price: "" });
  }
  function removeCustomItem(i) {
    setForm((f) => ({ ...f, customLineItems: f.customLineItems.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientName || !form.clientEmail || !form.address) {
      setError("Client name, email, and address are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      let res, data;

      if (isEdit) {
        res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            clientName:              form.clientName,
            clientEmail:             form.clientEmail,
            clientPhone:             form.clientPhone,
            address:                 form.address,
            unit:                    form.unit,
            city:                    form.city,
            state:                   form.state,
            zip:                     form.zip,
            fullAddress:             [form.address, form.unit, form.city, form.state, form.zip].filter(Boolean).join(", "),
            squareFootage:           Number(form.sqft) || null,
            notes:                   form.notes,
            shootDate:               form.shootDate,
            shootTime:               form.shootTime,
            shootDuration:           Number(form.shootDuration) || null,
            additionalAppointments:  form.additionalAppointments,
            packageId:               form.packageId,
            serviceIds:              form.serviceIds,
            addonIds:                form.addonIds,
            totalPrice:              pricing.total,
            depositPaid:             form.depositPaid,
            photographerId:          form.photographerId,
            photographerEmail:       form.photographerEmail,
            photographerName:        form.photographerName,
            photographerPhone:       form.photographerPhone,
            additionalPhotographers: form.additionalPhotographers,
          }),
        });
        data = await res.json();
        if (res.ok) {
          if (onSuccess) onSuccess(bookingId);
          else router.push("/dashboard/bookings");
        } else {
          setError(data.error || "Failed to save changes.");
        }
      } else {
        res = await fetch("/api/dashboard/bookings/create", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...form,
            totalPrice:         pricing.total,
            sqft:               Number(form.sqft) || "",
            contractSignerName: contractSigned ? contractSignerName.trim() : null,
            sendAgreementEmail: !contractSigned && form.sendAgreementEmail ? true : undefined,
          }),
        });
        data = await res.json();
        if (res.ok) {
          if (onSuccess) onSuccess(data.bookingId);
          else router.push(`/dashboard/listings/${data.bookingId}`);
        } else {
          setError(data.error || "Failed to create booking.");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const agentNameSuggestions  = agents.map((a) => a.name).filter(Boolean);
  const agentEmailSuggestions = agents.map((a) => a.email).filter(Boolean);
  const tier = getSqftTier(form.sqft, catalog.pricingConfig);
  const backHref  = "/dashboard/bookings";
  const backLabel = "← Bookings";
  const pageTitle = isEdit
    ? `Edit Booking${form.address ? ` · ${form.address}` : ""}`
    : "New Booking";

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-sm text-gray-400 hover:text-[#3486cf]">{backLabel}</Link>
        <span className="text-gray-300">/</span>
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Client, Property, Services ─────────────────── */}
          <div className="space-y-4">

            {/* Client / Agent */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Client / Agent Info</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AutocompleteInput
                  label="Name" required
                  value={form.clientName}
                  onChange={(v) => setForm((f) => ({ ...f, clientName: v }))}
                  onSelect={(name) => {
                    const agent = agents.find((a) => a.name === name);
                    if (agent) fillClient(agent); else setForm((f) => ({ ...f, clientName: name }));
                  }}
                  suggestions={agentNameSuggestions}
                  placeholder="Jane Smith"
                />
                <AutocompleteInput
                  label="Email" type="email" required
                  value={form.clientEmail}
                  onChange={(v) => { setForm((f) => ({ ...f, clientEmail: v })); setClientSaved(false); }}
                  onSelect={(email) => {
                    const agent = agents.find((a) => a.email === email);
                    if (agent) fillClient(agent); else setForm((f) => ({ ...f, clientEmail: email }));
                    setClientSaved(false);
                  }}
                  suggestions={agentEmailSuggestions}
                  placeholder="jane@example.com"
                />
                <div>
                  <label className="label-field">Phone</label>
                  <input type="tel" value={form.clientPhone} onChange={set("clientPhone")}
                    className="input-field w-full" placeholder="(555) 555-5555" />
                </div>
              </div>
              {form.clientName && form.clientEmail && !clientIsKnown && (
                <div className="mt-2 flex items-center gap-2">
                  {clientSaved ? (
                    <span className="text-xs text-green-600 font-medium">✓ Saved to customers</span>
                  ) : (
                    <button
                      type="button"
                      onClick={saveNewClient}
                      disabled={savingClient}
                      className="text-xs text-[#3486cf] hover:underline disabled:opacity-50"
                    >
                      {savingClient ? "Saving..." : "+ Save as new customer"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Property */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Property</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <PlacesAutocomplete
                    label="Street Address" required
                    value={form.address}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, address: v }));
                      if (v !== confirmedAddress) setConfirmedAddress("");
                    }}
                    onSelect={({ address, city, state, zip, lat, lng }) => {
                      setForm((f) => ({
                        ...f,
                        address: address || f.address,
                        city:    city    || f.city,
                        state:   state   || f.state,
                        zip:     zip     || f.zip,
                        lat:     lat     ?? f.lat,
                        lng:     lng     ?? f.lng,
                      }));
                      if (address) setConfirmedAddress(address);
                    }}
                    placeholder="Start typing an address…"
                  />
                </div>
                <div>
                  <label className="label-field">Unit / Suite</label>
                  <input type="text" value={form.unit} onChange={set("unit")} className="input-field w-full" placeholder="Apt 4B" />
                </div>
                <div>
                  <label className="label-field">City</label>
                  <input type="text" value={form.city} onChange={set("city")} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-field">State</label>
                  <input type="text" value={form.state} onChange={set("state")} className="input-field w-full" maxLength={2} />
                </div>
                <div>
                  <label className="label-field">ZIP</label>
                  <input type="text" value={form.zip} onChange={set("zip")} className="input-field w-full" maxLength={5} />
                </div>
                <div>
                  <label className="label-field">
                    Square Footage
                    {tier && <span className="text-xs text-[#3486cf] font-normal ml-1">({tier} tier)</span>}
                  </label>
                  <input type="number" value={form.sqft} onChange={set("sqft")} className="input-field w-full" placeholder="2400" />
                </div>
              </div>

              {serviceArea && !serviceArea.covered && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <strong>Outside service area.</strong> This address is outside your configured service zones. You can still {isEdit ? "save" : "create"} the booking manually.
                </div>
              )}
              {serviceArea?.covered && serviceArea.zoneName && (
                <p className="mt-2 text-xs text-green-600">Zone: {serviceArea.zoneName}</p>
              )}
              {travelFee != null && travelFee.miles > 0 && (
                <div className={`mt-3 rounded-lg px-4 py-3 text-sm border ${travelFee.travelFee > 0 ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                  {travelFee.travelFee > 0
                    ? <>Estimated travel fee: <strong>${travelFee.travelFee}</strong> ({travelFee.miles} mi). Add as a custom line item if needed.</>
                    : <>Travel: <strong>{travelFee.miles} mi</strong> — within free radius, no travel fee.</>
                  }
                </div>
              )}
            </div>

            {/* Services — compact summary + modal picker */}
            {(catalog.packages.length > 0 || catalog.services.length > 0 || catalog.addons.length > 0) && (() => {
              const selectedPkg   = catalog.packages.find((p) => p.id === form.packageId);
              const selectedSvcs  = catalog.services.filter((s) => form.serviceIds.includes(s.id));
              const selectedAddns = catalog.addons.filter((a) => form.addonIds.includes(a.id));
              const hasSelection  = selectedPkg || selectedSvcs.length > 0 || selectedAddns.length > 0;
              return (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide">Services</h2>
                    <button type="button" onClick={() => { setServicesSearch(""); setShowServicesModal(true); }}
                      className="text-xs font-medium text-[#3486cf] hover:text-[#2a6dab] transition-colors flex items-center gap-1">
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>
                      </svg>
                      Browse all
                    </button>
                  </div>

                  {hasSelection ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPkg && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#3486cf]/10 text-[#3486cf] border border-[#3486cf]/20">
                          {selectedPkg.name}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, packageId: "" }))}
                            className="hover:text-[#1e5a8a] transition-colors leading-none">×</button>
                        </span>
                      )}
                      {selectedSvcs.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#3486cf] text-white">
                          {s.name}
                          <button type="button" onClick={() => toggleService(s.id)}
                            className="hover:opacity-70 transition-opacity leading-none">×</button>
                        </span>
                      ))}
                      {selectedAddns.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                          {a.name}
                          <button type="button" onClick={() => toggleAddon(a.id)}
                            className="hover:opacity-70 transition-opacity leading-none">×</button>
                        </span>
                      ))}
                      <button type="button" onClick={() => { setServicesSearch(""); setShowServicesModal(true); }}
                        className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-[#3486cf]/50 hover:text-[#3486cf] transition-colors">
                        + Add more
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setServicesSearch(""); setShowServicesModal(true); }}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#3486cf]/40 hover:text-[#3486cf] transition-colors text-sm">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      Select package or services
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Services picker modal */}
            {showServicesModal && (() => {
              const q = servicesSearch.toLowerCase();
              const activePkgs  = catalog.packages.filter((p) => p.active !== false && (!q || p.name.toLowerCase().includes(q)));
              const activeSvcs  = catalog.services.filter((s) => s.active !== false && (!q || s.name.toLowerCase().includes(q)));
              const activeAddns = catalog.addons.filter((a) => a.active !== false  && (!q || a.name.toLowerCase().includes(q)));
              return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowServicesModal(false)} />
                  <div className="relative w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-[#0F172A] text-[15px]">Select Services</h3>
                      <button type="button" onClick={() => setShowServicesModal(false)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg leading-none">×</button>
                    </div>

                    {/* Search */}
                    <div className="px-5 py-3 border-b border-gray-100">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>
                        </svg>
                        <input autoFocus type="text" value={servicesSearch} onChange={(e) => setServicesSearch(e.target.value)}
                          placeholder="Search packages, services…"
                          className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf]" />
                      </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                      {activePkgs.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Packages</p>
                          <div className="space-y-2">
                            {activePkgs.map((p) => {
                              const price    = tier ? getItemPrice(p, tier) : getFromPrice(p, catalog.pricingConfig);
                              const fromLabel = !tier && p.priceTiers ? "from " : "";
                              const priceLabel = Number.isFinite(price) && price > 0 ? `${fromLabel}${formatPrice(price)}` : (p.priceTiers ? "–" : "$0");
                              const selected = form.packageId === p.id;
                              return (
                                <button key={p.id} type="button"
                                  onClick={() => setForm((f) => ({ ...f, packageId: f.packageId === p.id ? "" : p.id }))}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                                    selected ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-gray-300 bg-white"
                                  }`}>
                                  <div className="text-left">
                                    <p className={`font-medium ${selected ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{p.name}</p>
                                    {p.tagline && <p className="text-xs text-gray-400 mt-0.5">{p.tagline}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-sm font-semibold ${selected ? "text-[#3486cf]" : "text-gray-600"}`}>{priceLabel}</span>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                                      selected ? "bg-[#3486cf] border-[#3486cf]" : "border-gray-300"
                                    }`}>
                                      {selected && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeSvcs.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Services</p>
                          <div className="space-y-2">
                            {activeSvcs.map((s) => {
                              const price    = tier ? getItemPrice(s, tier) : getFromPrice(s, catalog.pricingConfig);
                              const fromLabel = !tier && s.priceTiers ? "from " : "";
                              const priceLabel = Number.isFinite(price) && price > 0 ? `${fromLabel}${formatPrice(price)}` : "";
                              const selected  = form.serviceIds.includes(s.id);
                              return (
                                <button key={s.id} type="button"
                                  onClick={() => toggleService(s.id)}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                                    selected ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-gray-300 bg-white"
                                  }`}>
                                  <p className={`font-medium text-left ${selected ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{s.name}</p>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-sm font-semibold ${selected ? "text-[#3486cf]" : "text-gray-600"}`}>{priceLabel}</span>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                                      selected ? "bg-[#3486cf] border-[#3486cf]" : "border-gray-300"
                                    }`}>
                                      {selected && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeAddns.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Add-ons</p>
                          <div className="space-y-2">
                            {activeAddns.map((a) => {
                              const price    = tier ? getItemPrice(a, tier) : getFromPrice(a, catalog.pricingConfig);
                              const fromLabel = !tier && a.priceTiers ? "from " : "";
                              const priceLabel = Number.isFinite(price) && price > 0 ? `${fromLabel}${formatPrice(price)}` : "";
                              const selected  = form.addonIds.includes(a.id);
                              return (
                                <button key={a.id} type="button" onClick={() => toggleAddon(a.id)}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                                    selected ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300 bg-white"
                                  }`}>
                                  <p className={`font-medium text-left ${selected ? "text-amber-800" : "text-[#0F172A]"}`}>{a.name}</p>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-sm font-semibold ${selected ? "text-amber-700" : "text-gray-600"}`}>{priceLabel}</span>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                                      selected ? "bg-amber-400 border-amber-400" : "border-gray-300"
                                    }`}>
                                      {selected && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activePkgs.length === 0 && activeSvcs.length === 0 && activeAddns.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-8">No results for "{servicesSearch}"</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-gray-100">
                      <button type="button" onClick={() => setShowServicesModal(false)}
                        className="w-full py-2.5 rounded-xl bg-[#3486cf] text-white text-sm font-semibold hover:bg-[#2a6dab] transition-colors">
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── RIGHT: Schedule, Pricing, Notes, Status, Submit ── */}
          <div className="space-y-4 lg:sticky lg:top-6">

            {/* Schedule + Team Availability */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Schedule</h2>

              <button type="button" onClick={() => setShowSchedulePopup(true)}
                className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#3486cf]/50 hover:bg-gray-50 transition-colors mb-4">
                <div>
                  {form.shootDate ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {form.shootTime && (() => { const [hh, mm] = form.shootTime.split(":"); const h = Number(hh); const sfx = h >= 12 ? "PM" : "AM"; return ` · ${h % 12 || 12}:${mm} ${sfx}`; })()}
                      </p>
                      {shootEndTime && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ends {shootEndTime}
                          {effectiveDuration > 0 ? ` · ${effectiveDuration >= 60 ? `${effectiveDuration / 60}h` : `${effectiveDuration}m`}` : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No date selected</p>
                  )}
                </div>
                <span className="text-xs font-medium text-[#3486cf] flex-shrink-0 ml-3">
                  {form.shootDate ? "Edit" : "Pick date →"}
                </span>
              </button>

              {catalog.showWeather && form.shootDate && confirmedAddress && (
                <WeatherWidget address={confirmedAddress} date={form.shootDate} lat={form.lat} lng={form.lng} />
              )}

              {form.additionalAppointments.map((appt, i) => {
                const displayDate = appt.date
                  ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  : null;
                const displayTime = appt.time
                  ? (() => { const [hh, mm] = appt.time.split(":"); const h = Number(hh); return `${h % 12 || 12}:${mm} ${h >= 12 ? "PM" : "AM"}`; })()
                  : null;
                return (
                  <button key={i} type="button" onClick={() => setApptPopupIdx(i)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#3486cf]/50 hover:bg-gray-50 transition-colors mb-2">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Appointment {i + 2}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayDate || <span className="text-gray-400 font-normal">No date set</span>}
                        {displayTime && <span className="text-gray-500 font-normal"> · {displayTime}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-xs font-medium text-[#3486cf]">Edit</span>
                      <span onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, additionalAppointments: f.additionalAppointments.filter((_, idx) => idx !== i) })); }}
                        className="text-gray-300 hover:text-red-400 text-sm leading-none cursor-pointer">✕</span>
                    </div>
                  </button>
                );
              })}
              <button type="button"
                onClick={() => {
                  const newIdx = form.additionalAppointments.length;
                  setForm((f) => ({ ...f, additionalAppointments: [...f.additionalAppointments, { date: "", time: "" }] }));
                  setApptPopupIdx(newIdx);
                }}
                className="w-full text-sm text-[#3486cf] border border-dashed border-[#3486cf]/30 px-3 py-2.5 rounded-xl hover:bg-[#3486cf]/5 transition-colors mb-4 font-medium">
                + Add Another Appointment
              </button>

              {/* Solo plan: self-assign only */}
              {getPlan(tenantPlan).teamSeats === 1 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assign Photographer</p>
                  <div
                    onClick={() => {
                      const isSelf = form.photographerId === "owner";
                      setForm((f) => ({
                        ...f,
                        photographerId:    isSelf ? "" : "owner",
                        photographerEmail: isSelf ? "" : (auth.currentUser?.email || ""),
                        photographerName:  isSelf ? "" : (auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Me"),
                        photographerPhone: "",
                        photographerTbd:   false,
                      }));
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      form.photographerId === "owner" ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-[#3486cf]/40"
                    }`}>
                    <div className="w-7 h-7 rounded-full bg-[#3486cf] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(auth.currentUser?.displayName?.[0] || auth.currentUser?.email?.[0] || "Y")?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">Assign Myself</p>
                      <p className="text-xs text-gray-400 truncate">{auth.currentUser?.email || "You"}</p>
                    </div>
                    {form.photographerId === "owner" && <span className="text-[#3486cf] text-[11px] font-semibold flex-shrink-0">✓ Primary</span>}
                  </div>
                  <div onClick={assignTbd}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      form.photographerTbd ? "border-[#3486cf] bg-[#3486cf]/5" : "border-dashed border-gray-300 hover:border-[#3486cf]/40"
                    }`}>
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">?</div>
                    <div className="flex-1"><p className="text-sm font-medium text-gray-500">Assign Later / TBD</p></div>
                    {form.photographerTbd && <span className="text-[#3486cf] text-[11px] font-semibold">✓ Selected</span>}
                  </div>
                  <p className="text-xs text-gray-400 pt-1">
                    Need additional photographers?{" "}
                    <a href="/dashboard/billing" className="text-[#3486cf] hover:underline">Upgrade to Studio →</a>
                  </p>
                </div>
              )}

              {/* Team plan: availability matrix */}
              {getPlan(tenantPlan).teamSeats !== 1 && form.shootDate && team.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Availability — {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    {travelLoading && <span className="text-xs text-gray-400 italic">Calculating…</span>}
                  </div>
                  <div className="space-y-2">
                    {team.filter((m) => m.active !== false).map((m) => {
                      const avail        = availability[m.id] || "available";
                      const isSelected   = form.photographerId === m.id && !form.photographerTbd;
                      const canSelect    = avail === "available";
                      const travel       = travelInfo[m.id];
                      const isAdditional = form.additionalPhotographers.some((p) => p.id === m.id);
                      return (
                        <div key={m.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
                            isSelected  ? "border-[#3486cf] bg-[#3486cf]/5"
                            : canSelect ? "border-gray-200 hover:border-[#3486cf]/40"
                            : "border-gray-100 bg-gray-50 opacity-60"
                          }`}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                            style={{ background: m.color || "#3486cf" }}>
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => canSelect && assignPhotographer(m)}>
                            <p className="text-sm font-medium text-[#0F172A] leading-tight">{m.name}</p>
                            {travel?.conflict && <p className="text-xs text-red-500 mt-0.5">Travel conflict — {travel.durationText} away</p>}
                            {travel && !travel.conflict && avail === "booked" && <p className="text-xs text-blue-500 mt-0.5">Another shoot {travel.distanceText} away</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              avail === "available"       ? "bg-green-50 text-green-700"   :
                              avail === "blocked"         ? "bg-red-50 text-red-600"       :
                              avail === "travel_conflict" ? "bg-red-50 text-red-600"       :
                              avail === "cant_perform"    ? "bg-orange-50 text-orange-600" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {avail === "available"       ? "Available"     :
                               avail === "blocked"         ? "Blocked"       :
                               avail === "travel_conflict" ? "Conflict"      :
                               avail === "cant_perform"    ? "Can't perform" :
                               "Booked"}
                            </div>
                            {isSelected
                              ? <span className="text-[#3486cf] text-[11px] font-semibold">✓ Primary</span>
                              : (
                                <button type="button" onClick={() => toggleAdditional(m)}
                                  className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium transition-colors ${
                                    isAdditional
                                      ? "bg-[#3486cf]/10 text-[#3486cf] border-[#3486cf]/20"
                                      : "text-gray-400 border-gray-200 hover:border-[#3486cf]/30 hover:text-[#3486cf]"
                                  }`}>
                                  {isAdditional ? "✓ Co-photo" : "+ Co-photo"}
                                </button>
                              )
                            }
                          </div>
                        </div>
                      );
                    })}
                    <div onClick={assignTbd}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                        form.photographerTbd ? "border-[#3486cf] bg-[#3486cf]/5" : "border-dashed border-gray-300 hover:border-[#3486cf]/40"
                      }`}>
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">?</div>
                      <div className="flex-1"><p className="text-sm font-medium text-gray-500">Assign Later / TBD</p></div>
                      {form.photographerTbd && <span className="text-[#3486cf] text-[11px] font-semibold">✓ Selected</span>}
                    </div>
                  </div>
                  {(form.photographerName || form.additionalPhotographers.length > 0) && (
                    <div className="mt-3 space-y-0.5">
                      {form.photographerName && (
                        <p className="text-xs text-green-600">
                          Primary: <strong>{form.photographerName}</strong>
                          {form.photographerTbd && <span className="text-amber-600"> — assign before shoot</span>}
                        </p>
                      )}
                      {form.additionalPhotographers.map((p) => (
                        <p key={p.id} className="text-xs text-blue-600">Co-photographer: <strong>{p.name}</strong></p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {form.shootDate && team.length === 0 && (
                <p className="text-xs text-gray-400">
                  No team members yet. <Link href="/dashboard/team" className="text-[#3486cf] underline">Add team members →</Link>
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Pricing</h2>
              {(form.packageId || form.serviceIds.length > 0 || form.addonIds.length > 0 || form.customLineItems.length > 0) ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                  {pricing.base > 0 && (
                    <div className="flex justify-between text-[#0F172A]">
                      <span>{form.packageId ? (catalog.packages.find((p) => p.id === form.packageId)?.name || "Package") : "Services"}</span>
                      <span>{formatPrice(pricing.base)}</span>
                    </div>
                  )}
                  {pricing.addonTotal > 0 && (
                    <div className="flex justify-between text-[#0F172A]">
                      <span>Add-ons</span><span>{formatPrice(pricing.addonTotal)}</span>
                    </div>
                  )}
                  {form.customLineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-[#0F172A]">
                      <span>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatPrice(item.price)}</span>
                        <button type="button" onClick={() => removeCustomItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-[#0F172A]">
                    <span>Total</span>
                    <span className="text-[#3486cf]">{formatPrice(pricing.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">Select services to auto-calculate.</p>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add Custom Item</p>
                <div className="flex gap-2">
                  <input type="text" value={newItem.label} onChange={(e) => setNewItem((n) => ({ ...n, label: e.target.value }))}
                    placeholder="Description" className="input-field flex-1 text-sm" />
                  <input type="number" value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
                    placeholder="$" className="input-field w-20 text-sm" min="0" step="0.01" />
                  <button type="button" onClick={addCustomItem} className="btn-outline px-3 py-2 text-sm flex-shrink-0">+ Add</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="depositPaid" checked={form.depositPaid}
                  onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.checked }))} />
                <label htmlFor="depositPaid" className="text-sm text-[#0F172A] cursor-pointer">Deposit already paid</label>
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Notes</h2>
              <textarea value={form.notes} onChange={set("notes")} rows={3}
                placeholder="Special instructions, access notes, lockbox code, etc."
                className="input-field w-full text-sm" />
            </div>

            {/* Service Agreement */}
            {!isEdit && catalog?.bookingConfig?.serviceAgreement?.enabled && catalog.bookingConfig.serviceAgreement.text && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide">Service Agreement</h2>
                  <span className="text-[10px] text-gray-400 font-medium">Optional — can skip</span>
                </div>
                {contractSigned ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Agreement signed</p>
                      <p className="text-xs text-emerald-700 mt-0.5">Signed as: <strong>{contractSignerName}</strong></p>
                    </div>
                    <button type="button" onClick={() => setContractSigned(false)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline">Undo</button>
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto mb-3">
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {catalog.bookingConfig.serviceAgreement.text}
                      </p>
                    </div>
                    {/* Sign in place */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={contractSignerName}
                        onChange={(e) => setContractSignerName(e.target.value)}
                        placeholder="Full name to sign"
                        className="input-field flex-1 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!contractSignerName.trim()}
                        onClick={() => contractSignerName.trim() && setContractSigned(true)}
                        className="btn-primary px-4 py-2 text-sm whitespace-nowrap disabled:opacity-40"
                      >
                        Sign
                      </button>
                    </div>
                    {/* Send to client email */}
                    <div className="flex items-center gap-2 mt-1">
                      <input type="checkbox" id="sendAgreementEmail" checked={form.sendAgreementEmail || false}
                        onChange={(e) => setForm((f) => ({ ...f, sendAgreementEmail: e.target.checked }))}
                        className="rounded" />
                      <label htmlFor="sendAgreementEmail" className="text-xs text-gray-500 cursor-pointer">
                        Email agreement to {form.clientEmail || "client"} for signing
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notifications + Submit */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="sendNotif" checked={form.sendNotification}
                  onChange={(e) => setForm((f) => ({ ...f, sendNotification: e.target.checked }))} />
                <label htmlFor="sendNotif" className="text-sm text-[#0F172A] cursor-pointer">
                  {isEdit ? "Send update email to client" : "Send booking confirmation to client"}
                </label>
              </div>
              {form.photographerEmail && !form.photographerTbd && (
                <p className="text-xs text-gray-400 mb-4">
                  Photographer notified: <strong>{form.photographerEmail}</strong>
                </p>
              )}
              <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-sm">
                {saving
                  ? (isEdit ? "Saving…" : "Creating…")
                  : isEdit
                    ? "Save Changes"
                    : `Create Booking${pricing.total > 0 ? ` · ${formatPrice(pricing.total)}` : ""}`
                }
              </button>
              <Link href={backHref} className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                Cancel
              </Link>
            </div>

          </div>
        </div>
      </form>

      {/* ── Additional appointment popup (split-panel: calendar + time) ─── */}
      {apptPopupIdx !== null && form.additionalAppointments[apptPopupIdx] !== undefined && (() => {
        const appt = form.additionalAppointments[apptPopupIdx];
        const setApptField = (field, value) =>
          setForm((f) => { const arr = [...f.additionalAppointments]; arr[apptPopupIdx] = { ...arr[apptPopupIdx], [field]: value }; return { ...f, additionalAppointments: arr }; });
        const apptToday = new Date();
        const apptTodayStr = `${apptToday.getFullYear()}-${String(apptToday.getMonth()+1).padStart(2,"0")}-${String(apptToday.getDate()).padStart(2,"0")}`;
        const aFirstDay = new Date(aCalYear, aCalMonth, 1).getDay();
        const aDaysInMonth = new Date(aCalYear, aCalMonth + 1, 0).getDate();
        const aCells = [];
        for (let i = 0; i < aFirstDay; i++) aCells.push(null);
        for (let d = 1; d <= aDaysInMonth; d++) aCells.push(d);
        while (aCells.length % 7 !== 0) aCells.push(null);
        const aMonthLabel = new Date(aCalYear, aCalMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
        const aRightStep = !appt.date ? "idle" : !appt.time ? "time" : !appt.duration ? "duration" : "confirm";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ height: "min(90vh, 580px)" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
                <h3 className="font-semibold text-[#0F172A]">Appointment {apptPopupIdx + 2}</h3>
                <button type="button" onClick={() => setApptPopupIdx(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Left: calendar */}
                <div className="w-64 flex-shrink-0 border-r border-gray-100 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={() => { if (aCalMonth===0){setACalYear(y=>y-1);setACalMonth(11);}else setACalMonth(m=>m-1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">‹</button>
                    <p className="text-xs font-semibold text-gray-700">{aMonthLabel}</p>
                    <button type="button" onClick={() => { if (aCalMonth===11){setACalYear(y=>y+1);setACalMonth(0);}else setACalMonth(m=>m+1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} className="text-center text-[9px] font-bold text-gray-400 pb-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {aCells.map((d,i) => {
                      if (!d) return <div key={i} className="aspect-square"/>;
                      const ds=`${aCalYear}-${String(aCalMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                      const isSel=appt.date===ds, isPast=ds<apptTodayStr, isToday=ds===apptTodayStr;
                      return (
                        <button key={i} type="button" disabled={isPast}
                          onClick={()=>!isPast&&setApptField("date",ds)}
                          className={`aspect-square rounded-lg text-[12px] font-medium flex items-center justify-center transition-all leading-none ${
                            isPast?"text-gray-300 cursor-not-allowed":isSel?"text-white":isToday?"font-bold":"text-gray-700 hover:bg-gray-100"
                          }`}
                          style={isSel?{backgroundColor:"#3486cf"}:isToday&&!isSel?{color:"#3486cf"}:{}}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Right: time selection */}
                <div className="flex-1 overflow-y-auto p-5">
                  {aRightStep === "idle" && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
                      </div>
                      <p className="text-sm font-medium text-gray-500">Select a date</p>
                    </div>
                  )}
                  {aRightStep === "time" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {new Date(appt.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 mb-3">Choose a start time</p>
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {TIME_SLOTS.filter((slot) => {
                          if (appt.date !== apptTodayStr) return true;
                          const nowMin = apptToday.getHours()*60+apptToday.getMinutes();
                          const [sh,sm]=slot.value.split(":").map(Number);
                          return (sh*60+sm)>nowMin;
                        }).map((slot) => {
                          const isSelected = appt.time === slot.value;
                          return (
                            <button key={slot.value} type="button"
                              onClick={() => setApptField("time", slot.value)}
                              className={`py-2 px-1 rounded-lg border text-[12px] font-medium text-center transition-all leading-tight ${
                                isSelected?"border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]":"border-gray-200 text-gray-600 hover:border-[#3486cf]/40 hover:bg-[#3486cf]/5"
                              }`}>
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400">Custom:</span>
                        <input type="time" value={appt.time}
                          onChange={(e) => setApptField("time", e.target.value)}
                          className="input-field text-sm py-1" style={{width:"auto"}} />
                      </div>
                    </div>
                  )}
                  {aRightStep === "duration" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Duration</p>
                      <p className="text-sm font-semibold text-gray-800 mb-3">How long is this appointment?</p>
                      <div className="space-y-1.5 mb-3">
                        {DURATION_PRESETS.map((dp) => {
                          const isSelected = appt.duration === String(dp.value);
                          return (
                            <button key={dp.value} type="button"
                              onClick={() => setApptField("duration", String(dp.value))}
                              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                                isSelected ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]" : "border-gray-200 text-gray-700 hover:border-[#3486cf]/40 hover:bg-[#3486cf]/5"
                              }`}>
                              {dp.label}
                              {isSelected && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400">Custom (min):</span>
                        <input type="number" min="0" max="720" step="15"
                          value={appt.duration || ""}
                          onChange={(e) => setApptField("duration", e.target.value)}
                          className="input-field text-sm py-1 w-24" placeholder="90" />
                      </div>
                      <button type="button" onClick={() => setApptField("duration", "skip")}
                        className="mt-3 text-xs text-gray-400 hover:text-gray-600 hover:underline">
                        Skip duration
                      </button>
                    </div>
                  )}
                  {aRightStep === "confirm" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Appointment {apptPopupIdx+2}</p>
                      <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 mb-4 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Date</p>
                            <p className="text-sm font-semibold text-gray-800">{new Date(appt.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
                          </div>
                          <button type="button" onClick={()=>setApptField("date","")} className="text-[11px] text-[#3486cf] hover:underline flex-shrink-0">Change</button>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Start Time</p>
                            <p className="text-sm font-semibold text-gray-800">{(() => { const [hh,mm]=appt.time.split(":");const h=Number(hh);return `${h%12||12}:${mm} ${h>=12?"PM":"AM"}`; })()}</p>
                          </div>
                          <button type="button" onClick={()=>setApptField("time","")} className="text-[11px] text-[#3486cf] hover:underline flex-shrink-0">Change</button>
                        </div>
                        {appt.duration && appt.duration !== "skip" && (
                          <div className="flex items-center gap-3 px-4 py-3">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4l3 3"/></svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Duration</p>
                              <p className="text-sm font-semibold text-gray-800">{(() => { const m=Number(appt.duration); return m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:""}`:`${m} min`; })()}</p>
                            </div>
                            <button type="button" onClick={()=>setApptField("duration","")} className="text-[11px] text-[#3486cf] hover:underline flex-shrink-0">Change</button>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={()=>setApptPopupIdx(null)}
                        className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors"
                        style={{backgroundColor:"#3486cf"}}>
                        Confirm Appointment ✓
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Schedule popup ─────────────────────────────────── */}
      {showSchedulePopup && (() => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        const monthLabel = new Date(calYear, calMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
        const rightStep = !form.shootDate ? "idle"
          : !form.shootTime ? "time"
          : form.shootDuration === "" && computedDuration === 0 ? "duration"
          : "confirm";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ height: "min(90vh, 600px)" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
                <h3 className="font-semibold text-[#0F172A]">Date &amp; Time</h3>
                <button type="button" onClick={() => setShowSchedulePopup(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Left: visual calendar */}
                <div className="w-64 flex-shrink-0 border-r border-gray-100 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <button type="button"
                      onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">‹</button>
                    <span className="text-xs font-semibold text-gray-700">{monthLabel}</span>
                    <button type="button"
                      onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((d, i) => (
                      <div key={i} className="text-center text-[9px] font-bold text-gray-400 pb-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {cells.map((d, i) => {
                      if (!d) return <div key={i} className="aspect-square" />;
                      const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const isSel = form.shootDate === ds;
                      const isPast = ds < todayStr;
                      const isToday = ds === todayStr;
                      return (
                        <button key={i} type="button" disabled={isPast}
                          onClick={() => !isPast && setForm(f => ({ ...f, shootDate: ds }))}
                          className={`aspect-square rounded-lg text-[12px] font-medium flex items-center justify-center transition-all leading-none ${
                            isPast ? "text-gray-300 cursor-not-allowed"
                            : isSel ? "text-white"
                            : isToday ? "font-bold"
                            : "text-gray-700 hover:bg-gray-100"
                          }`}
                          style={isSel ? { backgroundColor: "#3486cf" } : isToday && !isSel ? { color: "#3486cf" } : {}}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Right: progressive steps */}
                <div className="flex-1 overflow-y-auto p-5">
                  {rightStep === "idle" && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="1.5">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Select a date</p>
                        <p className="text-xs text-gray-400 mt-1">Choose from the calendar</p>
                      </div>
                    </div>
                  )}
                  {rightStep === "time" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 mb-3">Choose a start time</p>
                      {loadingSlots && <p className="text-[11px] text-gray-400 mb-2 italic">Checking availability…</p>}
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {TIME_SLOTS.filter((slot) => {
                          if (form.shootDate !== todayStr) return true;
                          const nowMin = today.getHours() * 60 + today.getMinutes();
                          const [sh, sm] = slot.value.split(":").map(Number);
                          return (sh * 60 + sm) > nowMin;
                        }).map((slot) => {
                          const isUnavail  = unavailableSlots.has(slot.value);
                          const isDirectly = busySlots.has(slot.value);
                          const isSelected = form.shootTime === slot.value;
                          return (
                            <button key={slot.value} type="button"
                              onClick={() => { if (!isUnavail) setForm(f => ({ ...f, shootTime: slot.value })); }}
                              disabled={isUnavail}
                              className={`py-2 px-1 rounded-lg border text-[12px] font-medium text-center transition-all leading-tight ${
                                isSelected ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]"
                                : isUnavail ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                                : "border-gray-200 text-gray-600 hover:border-[#3486cf]/40 hover:bg-[#3486cf]/5"
                              }`}>
                              <span className="block">{slot.label}</span>
                              {isUnavail && <span className="block text-[9px] leading-none mt-0.5 text-gray-300">{isDirectly ? "busy" : "—"}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400">Custom:</span>
                        <input type="time" value={form.shootTime}
                          onChange={(e) => setForm(f => ({ ...f, shootTime: e.target.value }))}
                          className="input-field text-sm py-1" style={{ width: "auto" }} />
                      </div>
                    </div>
                  )}
                  {rightStep === "duration" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Duration</p>
                      <p className="text-sm font-semibold text-gray-800 mb-3">How long is the shoot?</p>
                      {computedDuration > 0 && (
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, shootDuration: String(computedDuration) }))}
                          className={`w-full mb-3 flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            form.shootDuration === String(computedDuration)
                              ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]"
                              : "border-[#3486cf]/40 bg-[#3486cf]/5 text-[#3486cf] hover:bg-[#3486cf]/10"
                          }`}>
                          <span>
                            Suggested: {computedDuration >= 60
                              ? `${Math.floor(computedDuration / 60)}h${computedDuration % 60 ? ` ${computedDuration % 60}m` : ""}`
                              : `${computedDuration} min`}
                          </span>
                          <span className="text-[10px] font-normal opacity-70">based on services</span>
                        </button>
                      )}
                      <div className="space-y-1.5 mb-3">
                        {DURATION_PRESETS.map((d) => {
                          const isSelected = form.shootDuration === String(d.value) ||
                            (form.shootDuration === "" && computedDuration === d.value);
                          return (
                            <button key={d.value} type="button"
                              onClick={() => setForm(f => ({ ...f, shootDuration: String(d.value) }))}
                              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                                isSelected ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]" : "border-gray-200 text-gray-700 hover:border-[#3486cf]/40 hover:bg-[#3486cf]/5"
                              }`}>
                              {d.label}
                              {isSelected && (
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400">Custom (min):</span>
                        <input type="number" min="0" max="720" step="15"
                          value={form.shootDuration} onChange={set("shootDuration")}
                          className="input-field text-sm py-1 w-20" placeholder="—" />
                      </div>
                    </div>
                  )}
                  {rightStep === "confirm" && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Booking Schedule</p>
                      <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 mb-4 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Date</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <button type="button" onClick={() => setForm(f => ({ ...f, shootDate: "" }))}
                            className="text-[11px] text-[#3486cf] hover:underline flex-shrink-0">Change</button>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0">
                            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Start Time</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {(() => { const [hh, mm] = form.shootTime.split(":"); const h = Number(hh); return `${h % 12 || 12}:${mm} ${h >= 12 ? "PM" : "AM"}`; })()}
                              {shootEndTime && <span className="text-xs text-gray-400 font-normal ml-1">→ ends {shootEndTime}</span>}
                            </p>
                          </div>
                          <button type="button" onClick={() => setForm(f => ({ ...f, shootTime: "" }))}
                            className="text-[11px] text-[#3486cf] hover:underline flex-shrink-0">Change</button>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0">
                            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4h4"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Duration</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {DURATION_PRESETS.map((d) => {
                                const isSelected = form.shootDuration === String(d.value) || (form.shootDuration === "" && computedDuration === d.value);
                                return (
                                  <button key={d.value} type="button"
                                    onClick={() => setForm(f => ({ ...f, shootDuration: f.shootDuration === String(d.value) ? "" : String(d.value) }))}
                                    className={`py-0.5 px-2 text-[11px] rounded-md border transition-colors font-medium ${
                                      isSelected ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]" : "border-gray-200 text-gray-500 hover:border-[#3486cf]/40 hover:text-[#3486cf]"
                                    }`}>
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                            {computedDuration > 0 && form.shootDuration === "" && (
                              <p className="text-[10px] text-gray-400 mt-1">{computedDuration} min · from services</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <button type="button"
                        onClick={async () => {
                          setShowSchedulePopup(false);
                          if (isEdit && bookingId) {
                            setSaving(true);
                            try {
                              const token = await getToken();
                              await fetch(`/api/dashboard/bookings/${bookingId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({
                                  shootDate:     form.shootDate,
                                  shootTime:     form.shootTime,
                                  shootDuration: Number(form.shootDuration) || null,
                                }),
                              });
                            } catch { /* non-critical — full save still available */ }
                            finally { setSaving(false); }
                          }
                        }}
                        className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors"
                        style={{ backgroundColor: "#3486cf" }}>
                        {saving ? "Saving…" : "Confirm Schedule ✓"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
