"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import PriceSummary from "@/components/booking/PriceSummary";

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
  const { address, city, state, zip, squareFootage, propertyType, notes, setProperty, customFields, setCustomFields } =
    useBookingStore();
  const [configFields, setConfigFields] = useState([]); // admin-defined custom fields
  const [fieldValues, setFieldValues] = useState(customFields || {});

  useEffect(() => {
    fetch(`/api/tenant-public/${params.slug}/catalog`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bookingConfig?.customFields?.length) {
          setConfigFields(data.bookingConfig.customFields);
        }
      })
      .catch(() => {});
  }, [params.slug]);

  function handleChange(e) {
    setProperty({ [e.target.name]: e.target.value });
  }

  function handleCustomField(id, value) {
    const updated = { ...fieldValues, [id]: value };
    setFieldValues(updated);
    if (setCustomFields) setCustomFields(updated);
  }

  const requiredCustom = configFields.filter((f) => f.required);
  const allRequiredFilled = requiredCustom.every((f) => (fieldValues[f.id] || "").trim());
  const isValid = address.trim() && city.trim() && zip.trim() && allRequiredFilled;

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
                <input name="address" value={address} onChange={handleChange}
                  placeholder="123 Sunset Blvd" className="input-field" />
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

            <div className="flex justify-between mt-8">
              <button onClick={() => router.push(`/${params.slug}/book/addons`)} className="btn-outline">← Back</button>
              <button onClick={() => isValid && router.push(`/${params.slug}/book/review`)}
                disabled={!isValid} className="btn-primary px-12">Continue →</button>
            </div>
          </div>
          <div className="lg:col-span-1"><PriceSummary /></div>
        </div>
      </div>
    </>
  );
}
