"use client";

import { useBookingStore } from "@/store/bookingStore";
import { PACKAGES, SERVICES, ADDONS, formatPrice } from "@/lib/pricing";
import { getSqftTier, getItemPrice } from "@/lib/catalogUtils";

const TIME_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  flexible: "Flexible",
};

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// catalog prop overrides the static defaults (used in multi-tenant [slug]/book pages)
export default function PriceSummary({ showDeposit = false, catalog = null }) {
  const {
    packageIds, serviceIds, addonIds, pricing, travelFee, squareFootage,
    preferredDate, preferredTime, address, city, state,
    clientName, clientEmail, photographerId,
  } = useBookingStore();
  const pkgIds = packageIds || [];
  const tier = getSqftTier(squareFootage);

  const packages = catalog?.packages || PACKAGES;
  const services = catalog?.services || SERVICES;
  const addons   = catalog?.addons   || ADDONS;
  const photographers = catalog?.photographers || [];

  const selectedPkgs   = packages.filter((p) => pkgIds.includes(p.id));
  const selectedSvcs   = services.filter((s) => serviceIds.includes(s.id));
  const selectedAddons = addons.filter((a) => addonIds.includes(a.id));

  if (!pricing && pkgIds.length === 0 && serviceIds.length === 0) return null;

  const subtotal = pricing?.subtotal ?? 0;
  const deposit  = pricing?.deposit  ?? 0;
  const balance  = pricing?.balance  ?? 0;

  const photographer = photographers.find((p) => p.id === photographerId || p.memberId === photographerId);
  const appointment = preferredDate ? `${formatDate(preferredDate)} · ${TIME_LABELS[preferredTime] || preferredTime || ""}` : "";
  const propertyLine = address ? `${address}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""}` : "";
  const bookedBy = clientName || clientEmail || "";

  const trustLines = Array.isArray(catalog?.bookingConfig?.trustBadges)
    ? catalog.bookingConfig.trustBadges.filter((t) => t && t.trim())
    : [];

  const ContextRow = ({ label, value, sub }) =>
    value ? (
      <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: "1px solid #F1EDE4" }}>
        <div>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#A8843F", marginBottom: 2 }}>{label}</p>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "#181B20", lineHeight: 1.3 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: "#8A8F98", marginTop: 1 }}>{sub}</p>}
        </div>
      </div>
    ) : null;

  return (
    <div className="card sticky top-6" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #EFEAE0" }}>
        <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: "#181B20" }}>Your shoot</p>
        <p style={{ fontSize: 12.5, color: "#8A8F98", marginTop: 2 }}>
          {showDeposit ? "Only a deposit is due today." : "Review your selections."}
        </p>
      </div>

      {(appointment || propertyLine || bookedBy) && (
        <div style={{ padding: "4px 20px 8px" }}>
          <ContextRow label="Appointment" value={appointment} sub={photographer ? `with ${photographer.name || photographer.displayName || ""}` : ""} />
          <ContextRow label="Property" value={propertyLine} />
          <ContextRow label="Booked by" value={bookedBy} sub={clientName && clientEmail ? clientEmail : ""} />
        </div>
      )}

      <div style={{ padding: "12px 20px 18px" }}>
        <div className="space-y-2 text-sm font-body">
          {selectedPkgs.map((pk) => (
            <div key={pk.id} className="flex justify-between">
              <span style={{ color: "#181B20", fontWeight: 600 }}>{pk.name} Package</span>
              <span style={{ color: "#181B20" }}>{formatPrice(getItemPrice(pk, tier))}</span>
            </div>
          ))}

          {selectedSvcs.map((s) => (
            <div key={s.id} className="flex justify-between">
              <span style={{ color: "#52555C" }}>{s.name}</span>
              <span style={{ color: "#52555C" }}>{formatPrice(getItemPrice(s, tier))}</span>
            </div>
          ))}

          {selectedAddons.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #F1EDE4", paddingTop: 8, marginTop: 6 }} />
              {selectedAddons.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span style={{ color: "#52555C" }}>{a.name}</span>
                  <span style={{ color: "#52555C" }}>{formatPrice(getItemPrice(a, tier))}</span>
                </div>
              ))}
            </>
          )}

          {travelFee > 0 && (
            <div className="flex justify-between" style={{ color: "#8A8F98" }}>
              <span>Travel fee</span>
              <span>{formatPrice(travelFee)}</span>
            </div>
          )}

          <div style={{ borderTop: "1px solid #E7E2D7", paddingTop: 12, marginTop: 10 }}>
            <div className="flex justify-between" style={{ fontWeight: 700, fontSize: 16 }}>
              <span style={{ color: "#181B20" }}>Total</span>
              <span style={{ color: "#181B20" }}>{formatPrice(subtotal)}</span>
            </div>
          </div>

          {showDeposit && subtotal > 0 && (
            <div style={{ background: "#FAF6EC", borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
              <div className="flex justify-between" style={{ color: "#A8843F", fontWeight: 700 }}>
                <span>Due today</span>
                <span>{formatPrice(deposit)}</span>
              </div>
              <div className="flex justify-between" style={{ color: "#8A8F98", marginTop: 3, fontSize: 13 }}>
                <span>Balance when photos are ready</span>
                <span>{formatPrice(balance)}</span>
              </div>
            </div>
          )}
        </div>

        {trustLines.length > 0 && (
          <ul style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
            {trustLines.map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#6B7280", lineHeight: 1.35 }}>
                <span style={{ color: "#A8843F", flexShrink: 0 }}>✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
