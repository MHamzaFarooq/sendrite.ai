/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pulled from the reference mockups in /reference.
        ink: {
          900: "#05080f",
          800: "#080d18",
          700: "#0c1322",
          600: "#111a2c",
          500: "#18243a",
        },
        accent: {
          DEFAULT: "#2F97F8",
          soft: "#4aa8ff",
          deep: "#1b6fd6",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(47, 155, 255, 0.35)",
        pill: "0 4px 14px rgba(0, 0, 0, 0.35)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        pop: "pop 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pop-fast": "pop 100ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};
