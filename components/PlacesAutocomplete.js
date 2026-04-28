"use client";

import { useEffect, useRef, useState, useCallback } from "react";


function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function parseResult(result) {
  const a = result.address || {};
  const streetNum  = a.house_number || "";
  const streetName = a.road || a.pedestrian || "";
  const address    = [streetNum, streetName].filter(Boolean).join(" ") || result.display_name?.split(",")[0] || "";
  const city       = a.city || a.town || a.village || a.county || "";
  const state      = a.state || "";
  const zip        = a.postcode || "";
  return {
    address,
    city,
    state,
    zip,
    fullAddress: result.display_name || address,
    lat: parseFloat(result.lat) || null,
    lng: parseFloat(result.lon) || null,
  };
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
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [inputVal,    setInputVal]    = useState(value || "");
  const containerRef  = useRef(null);
  const activeRef     = useRef(false);

  // Keep inputVal in sync with external value changes
  useEffect(() => { setInputVal(value || ""); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 3) { setSuggestions([]); return; }
      try {
        const res  = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data.slice(0, 6));
          setOpen(true);
        }
      } catch {
        setSuggestions([]);
      }
    }, 280),
    []
  );

  function handleChange(e) {
    const val = e.target.value;
    setInputVal(val);
    onChange?.(val);
    activeRef.current = true;
    fetchSuggestions(val);
  }

  function handleSelect(result) {
    const parsed = parseResult(result);
    setInputVal(parsed.fullAddress);
    setSuggestions([]);
    setOpen(false);
    activeRef.current = false;
    onChange?.(parsed.fullAddress);
    onSelect?.(parsed);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); setSuggestions([]); }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="label-field">
          {label}{required && " *"}
        </label>
      )}
      <input
        type="text"
        value={inputVal}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="new-password"
        className={className || "input-field w-full"}
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg max-h-64 overflow-y-auto"
          style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-hover)" }}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.03)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span className="font-medium">{s.display_name?.split(",")[0]}</span>
                <span className="text-gray-400 text-xs ml-1">{s.display_name?.split(",").slice(1, 3).join(",")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
