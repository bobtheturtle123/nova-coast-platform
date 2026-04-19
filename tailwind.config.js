/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./pages/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette — deep slate, not blue
        navy: {
          DEFAULT: "#0F172A",
          dark:    "#020617",
          light:   "#1E293B",
        },
        gold: {
          DEFAULT: "#C9A96E",
          light:   "#DFC898",
          dark:    "#A8843F",
        },
        // App chrome
        cream:   "#F8F9FB",
        charcoal: "#0F172A",
        // Semantic aliases
        border: "#E5E7EB",
        surface: "#FFFFFF",
        muted: "#6B7280",
        // Override gray scale for legibility — default gray-400 (#9CA3AF) fails WCAG AA at small sizes
        gray: {
          50:  "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#8A93A6",
          500: "#5F6677",
          600: "#4B5261",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
          950: "#030712",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body:    ["Inter", "system-ui", "sans-serif"],
        serif:   ['"Playfair Display"', "Georgia", "serif"],
      },
      borderRadius: {
        "sm": "6px",
        DEFAULT: "8px",
        "lg": "10px",
        "xl": "12px",
        "2xl": "16px",
      },
      boxShadow: {
        "card":       "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 16px 0 rgb(0 0 0 / 0.07), 0 1px 3px 0 rgb(0 0 0 / 0.04)",
        "modal":      "0 24px 64px -12px rgb(0 0 0 / 0.22), 0 0 0 1px rgb(0 0 0 / 0.05)",
        "popover":    "0 8px 24px -4px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.06)",
      },
      animation: {
        "fade-up":    "fadeUp 0.48s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":    "fadeIn 0.32s ease-out forwards",
        "slide-down": "slideDown 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(8px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideDown: {
          from: { opacity: 0, transform: "translateY(-6px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
