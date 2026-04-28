/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./pages/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        navy: {
          DEFAULT: "#0F172A",
          dark:    "#020617",
          light:   "#1E293B",
          50:      "#F0F3FA",
          100:     "#DDE4F0",
        },
        gold: {
          DEFAULT: "#C9A96E",
          light:   "#DFC898",
          dark:    "#A8843F",
          50:      "#FEFBF4",
          100:     "#FDF3DC",
        },
        // App chrome — slightly cooler for modern SaaS feel
        cream:    "#F2F4F8",
        charcoal: "#0F172A",
        // Semantic
        surface: "#FFFFFF",
        muted:   "#6B7280",
        // Gray scale — WCAG AA compliant at small sizes
        gray: {
          50:  "#F9FAFB",
          100: "#F3F4F6",
          150: "#ECEEF2",
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
        "xs":    "4px",
        "sm":    "8px",
        DEFAULT: "10px",
        "md":    "12px",
        "lg":    "14px",
        "xl":    "16px",
        "2xl":   "20px",
        "3xl":   "28px",
        "4xl":   "36px",
      },
      boxShadow: {
        "xs":          "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        "card":        "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover":  "0 6px 20px -3px rgb(0 0 0 / 0.1), 0 2px 8px -2px rgb(0 0 0 / 0.05)",
        "card-raised": "0 10px 28px -5px rgb(0 0 0 / 0.12), 0 4px 10px -3px rgb(0 0 0 / 0.06)",
        "modal":       "0 24px 64px -12px rgb(0 0 0 / 0.24), 0 0 0 1px rgb(0 0 0 / 0.05)",
        "popover":     "0 8px 24px -4px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.06)",
        "inner":       "inset 0 1px 2px 0 rgb(0 0 0 / 0.06)",
        "glow-gold":   "0 0 20px 0 rgb(201 169 110 / 0.25)",
        "glow-navy":   "0 0 20px 0 rgb(15 23 42 / 0.2)",
      },
      animation: {
        "fade-up":    "fadeUp 0.48s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":    "fadeIn 0.32s ease-out forwards",
        "slide-down": "slideDown 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up":   "slideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in":   "scaleIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "shimmer":    "shimmer 1.8s infinite linear",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(10px)" },
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
        slideUp: {
          from: { opacity: 0, transform: "translateY(6px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: 0, transform: "scale(0.92)" },
          to:   { opacity: 1, transform: "scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to:   { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
