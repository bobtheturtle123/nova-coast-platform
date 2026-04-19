"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import PriceSummary from "@/components/booking/PriceSummary";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "condo",       label: "Condo / Townhome" },
  { value: "commercial",  label: "Commercial" },
  { value: "land",        label: "Land / Lot" },
  { value: "luxury",      label: "Luxury Estate" },
];

export default function TenantPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const {
    address, city, state, zip, squareFootage, propertyType, notes,
    setProperty, customFields, setCustomFields, setServiceZone,
  } = useBookingStore();

  const [configFields,       setConfigFields]       = useState([]);
  const [fieldValues,        setFieldValues]        = useState(customFields || {});
  const [requireServiceArea, setRequireServiceArea] = useState(false);
  const [checking,           setChecking]           = useState(false);
  const [zoneError,          setZoneError]          = useState(null); // { contact }
  const [geocodeError,       setGeocodeError]       = useState(false);

  useEffect(() => {
    fetch(`/api/tenant-public/${params.slug}/catalog`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bookingConfig?.customFields?.length) {
          setConfigFields(data.bookingConfig.customFields);
        }
        setRequireServiceArea(!!data.bookingConfig?.requireServiceArea);
      })
      .catch(() => {});
  }, [params.slug]);

  function handleChange(e) {
    setProperty({ [e.target.name]: e.target.value });
    // Clear zone error when address changes
    if (["address", "city", "state", "zip"].includes(e.target.name)) {
      setZoneError(null);
      setGeocodeError(false);
    }
  }

  function handleCustomField(id, value) {
    const updated = { ...fieldValues, [id]: value };
    setFieldValues(updated);
    if (setCustomFields) setCustomFields(updated);
  }

  const requiredCustom = configFields.filter((f) => f.required);
  const allRequiredFilled = requiredCustom.every((f) => (fieldValues[f.id] || "").trim());
  const isValid = address.trim() && city.trim() && zip.trim() && allRequiredFilled;

  async function handleContinue() {
    if (!isValid) return;

    if (requireServiceArea) {
      setChecking(true);
      setZoneError(null);
      setGeocodeError(false);
      try {
        const fullAddress = [address.trim(), city.trim(), state.trim(), zip.trim()]
          .filter(Boolean).join(", ");
        const res = await fetch(`/api/tenant-public/${params.slug}/check-service-area`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: fullAddress }),
        });
        const data = await res.json();

        if (data.geocodeError) {
          setGeocodeError(true);
          setChecking(false);
          return;
        }

        if (!data.covered) {
          setZoneError(data.contact || {});
          setChecking(false);
          return;
        }

        // Store zone photographers so schedule step can filter
        setServiceZone(data.assignedPhotographers || [], data.zoneName || null);
      } catch {
        // Network error — fail open
      }
      setChecking(false);
    }

    router.push(`/${params.slug}/book/review`);
  }

  return (
    <>
      <StepProgress current={3} />
      <div className="step-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <div className="mb-8">
              <p className="section-label mb-2">Step 3 of 6</p>
              <h1 className="font-display text-4xl text-navy mb-3">Property details.</h1>
              <p className="font-body text-gray-500">We'll use your address to calculate any travel fee and confirm availability.</p>
            </div>

            <div className="card space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Street Address <span className="text-red-400">*</span>
                </label>
                <PlacesAutocomplete
                  value={address}
                  onChange={(val) => setProperty({ address: val })}
                  onSelect={(parts) => {
                    setProperty({
                      address: parts.address,
                      city:    parts.city,
                      state:   parts.state,
                      zip:     parts.zip,
                    });
                    setZoneError(null);
                    setGeocodeError(false);
                  }}
                  placeholder="123 Sunset Blvd"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-charcoal mb-1.5">
                    City <span className="text-red-400">*</span>
                  </label>
                  <input name="city" value={city} onChange={handleChange}
                    placeholder="San Diego" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">State</label>
                  <input name="state" value={state} onChange={handleChange}
                    placeholder="CA" maxLength={2} className="input-field uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">
                    ZIP <span className="text-red-400">*</span>
                  </label>
                  <input name="zip" value={zip} onChange={handleChange}
                    placeholder="92101" maxLength={5} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Property Type</label>
                <select name="propertyType" value={propertyType} onChange={handleChange} className="input-field">
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Square Footage <span className="text-gray-400 font-normal ml-1">(approximate)</span>
                </label>
                <input name="squareFootage" value={squareFootage} onChange={handleChange}
                  placeholder="2,400" type="number" className="input-field" />
              </div>

              {/* Admin-configured custom fields */}
              {configFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">
                    {field.label}
                    {field.required
                      ? <span className="text-red-400 ml-1">*</span>
                      : <span className="text-gray-400 font-normal ml-1">(optional)</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea value={fieldValues[field.id] || ""} rows={2}
                      onChange={(e) => handleCustomField(field.id, e.target.value)}
                      className="input-field resize-none" />
                  ) : (
                    <input type={field.type || "text"} value={fieldValues[field.id] || ""}
                      onChange={(e) => handleCustomField(field.id, e.target.value)}
                      className="input-field" />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Notes for the Photographer <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <textarea name="notes" value={notes} onChange={handleChange} rows={3}
                  placeholder="Gate code, parking instructions, anything we should know..."
                  className="input-field resize-none" />
              </div>
            </div>

            {/* Geocode error */}
            {geocodeError && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800">Address not recognized</p>
                <p className="text-xs text-amber-700 mt-1">
                  Please double-check the address and try again.
                </p>
              </div>
            )}

            {/* Service area block */}
            {zoneError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-5">
                <p className="text-base font-semibold text-red-700 mb-1">Outside our service area</p>
                <p className="text-sm text-red-600 mb-3">
                  Unfortunately, this address is outside the areas we currently serve. Please contact us to discuss your options.
                </p>
                {(zoneError.phone || zoneError.email) && (
                  <div className="flex flex-col gap-1">
                    {zoneError.phone && (
                      <a href={`tel:${zoneError.phone}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:underline">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {zoneError.phone}
                      </a>
                    )}
                    {zoneError.email && (
                      <a href={`mailto:${zoneError.email}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:underline">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {zoneError.email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button onClick={() => router.push(`/${params.slug}/book/addons`)} className="btn-outline">← Back</button>
              <button
                onClick={handleContinue}
                disabled={!isValid || checking || !!zoneError}
                className="btn-primary px-12 flex items-center gap-2"
              >
                {checking && (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {checking ? "Checking…" : "Continue →"}
              </button>
            </div>
          </div>
          <div className="lg:col-span-1"><PriceSummary /></div>
        </div>
      </div>
    </>
  );
}
