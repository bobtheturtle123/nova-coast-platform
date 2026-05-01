// Template definitions and color presets for property websites

export const TEMPLATES = {
  modern: {
    label: "Modern",
    description: "Full-bleed hero, dark overlays, bold stats bar",
    presets: {
      preset1: { primary: "#3486cf", accent: "#c9a96e", label: "Blue & Gold" },
      preset2: { primary: "#1a1a2e", accent: "#10b981", label: "Charcoal & Emerald" },
    },
  },
  classic: {
    label: "Classic",
    description: "Clean white layout, contained hero, traditional sidebar",
    presets: {
      preset1: { primary: "#1e3a5f", accent: "#b08d57", label: "Blue & Brass" },
      preset2: { primary: "#1a3a2a", accent: "#c8a96e", label: "Forest & Gold" },
    },
  },
  luxury: {
    label: "Luxury",
    description: "Editorial split hero, oversized typography, dark panels",
    presets: {
      preset1: { primary: "#0d0d0d", accent: "#d4af8a", label: "Obsidian & Champagne" },
      preset2: { primary: "#1e2433", accent: "#c9848a", label: "Slate & Rose Gold" },
    },
  },
};

// Resolve active colors from pw + base branding
export function resolveTheme(pw, branding) {
  const template = pw.template || "modern";
  const preset   = pw.colorPreset || "preset1";

  if (preset === "custom") {
    return {
      primary: pw.customPrimary || branding.primary,
      accent:  pw.customAccent  || branding.accent,
    };
  }

  return TEMPLATES[template]?.presets?.[preset] || {
    primary: branding.primary,
    accent:  branding.accent,
  };
}
