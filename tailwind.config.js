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
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body:    ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "sm": "6px",
        DEFAULT: "8px",
        "lg": "10px",
        "xl": "12px",
        "2xl": "16px",
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)",
        "modal": "0 20px 60px -10px rgb(0 0 0 / 0.20)",
      },
      animation: {
        "fade-up": "fadeUp 0.35s ease forwards",
        "fade-in": "fadeIn 0.25s ease forwards",
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
      },
    },
  },
  plugins: [],
};
