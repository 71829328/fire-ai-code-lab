/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade visual FIRE Intelligence
        fire: {
          DEFAULT: "#ff7a1a",
          soft: "#ffa04d",
          deep: "#c2410c",
        },
        cyan: {
          glow: "#22d3ee",
        },
        violet: {
          glow: "#a855f7",
        },
        night: {
          950: "#05070f",
          900: "#0a0f1c",
          800: "#0f1626",
          700: "#151f33",
          600: "#1d2a44",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 122, 26, 0.35)",
        "glow-cyan": "0 0 26px rgba(34, 211, 238, 0.28)",
        "glow-violet": "0 0 26px rgba(168, 85, 247, 0.28)",
        panel: "0 18px 40px -20px rgba(0, 0, 0, 0.85)",
      },
      backgroundImage: {
        "fire-gradient":
          "linear-gradient(135deg, #ff7a1a 0%, #ff4d6d 45%, #a855f7 100%)",
        "grid-lines":
          "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.6s linear infinite",
      },
    },
  },
  plugins: [],
};
