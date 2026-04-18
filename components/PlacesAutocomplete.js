"use client";

/**
 * Google Places address autocomplete.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_KEY env var.
 * Falls back to a plain text input if key is not set.
 *
 * Props:
 *   value        — current address string
 *   onSelect(parts) — called with { address, city, state, zip, lat, lng, fullAddress }
 *   onChange(val)   — called on every keystroke (for controlled input)
 *   placeholder, required, className
 */

import { useEffect, useRef, useState } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

let scriptLoaded = false;
let scriptLoading = false;
const callbacks = [];

function loadGoogleMaps(cb) {
  if (typeof window === "undefined") return;
  if (window.google?.maps?.places) { cb(); return; }
  callbacks.push(cb);
  if (scriptLoading) return;
  scriptLoading = true;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&loading=async`;
  script.async = true;
  script.onload = () => { scriptLoaded = true; callbacks.forEach((fn) => fn()); };
  document.head.appendChild(script);
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "123 Main St",
  required = false,
  className,
  label,
}) {
  const inputRef  = useRef(null);
  const acRef     = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!MAPS_KEY) return; // no key — plain input fallback
    loadGoogleMaps(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.address_components) return;

      const get = (type) =>
        place.address_components.find((c) => c.types.includes(type));

      const streetNum = get("street_number")?.short_name || "";
      const streetName = get("route")?.short_name || "";
      const city  = get("locality")?.long_name || get("sublocality")?.long_name || "";
      const state = get("administrative_area_level_1")?.short_name || "";
      const zip   = get("postal_code")?.short_name || "";
      const address = [streetNum, streetName].filter(Boolean).join(" ");

      onSelect?.({
        address,
        city,
        state,
        zip,
        fullAddress: place.formatted_address || address,
        lat: place.geometry?.location?.lat?.() ?? null,
        lng: place.geometry?.location?.lng?.() ?? null,
      });
    });

    acRef.current = ac;

    // Prevent form submit on Enter while autocomplete dropdown is open
    inputRef.current.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });
  }, [ready]);

  return (
    <div>
      {label && (
        <label className="label-field">
          {label}{required && " *"}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="new-password"
        className={className || "input-field w-full"}
      />
      {!MAPS_KEY && (
        <p className="text-[10px] text-amber-500 mt-0.5">
          Add NEXT_PUBLIC_GOOGLE_MAPS_KEY for address autocomplete.
        </p>
      )}
    </div>
  );
}
