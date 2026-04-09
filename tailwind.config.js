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
        navy: {
          DEFAULT: "#0b2a55",
          dark: "#071d3a",
          light: "#1a4080",
        },
        gold: {
          DEFAULT: "#c9a96e",
          light: "#dfc898",
          dark: "#a8843f",
        },
        cream: "#faf8f4",
        charcoal: "#1c1c1c",
      },
      fontFamily: {
        display: ["Gloock", "Georgia", "serif"],
        body: ["DM Sans", "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
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
