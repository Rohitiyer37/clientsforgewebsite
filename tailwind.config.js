/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0A0A",
          card: "#161616",
          raised: "#1C1C1C",
          line: "#242424",
        },
        gold: {
          light: "#E8C078",
          DEFAULT: "#C9A24B",
          deep: "#8B6F2E",
        },
        fg: {
          DEFAULT: "#EDEDED",
          muted: "#A0A0A0",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(180deg, #E8C078 0%, #8B6F2E 100%)",
        "gold-gradient-135": "linear-gradient(135deg, #E8C078 0%, #8B6F2E 100%)",
      },
      boxShadow: {
        card: "0 20px 60px -20px rgba(0,0,0,0.7)",
        glow: "0 0 80px -10px rgba(201,162,75,0.35)",
      },
      keyframes: {
        "orb-drift": {
          "0%, 100%": { transform: "translate(-50%, 0) scale(1)" },
          "50%": { transform: "translate(-50%, -3%) scale(1.06)" },
        },
        "glow-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate(5%, 4%) scale(1.12)", opacity: "0.8" },
        },
        "aurora-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "orb-drift": "orb-drift 12s ease-in-out infinite",
        "glow-drift": "glow-drift 16s ease-in-out infinite",
        "aurora-spin": "aurora-spin 44s linear infinite",
        marquee: "marquee 55s linear infinite",
        "marquee-reverse": "marquee 55s linear infinite reverse",
        "fade-in": "fade-in 0.8s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
