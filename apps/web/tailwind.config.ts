import type { Config } from "tailwindcss";

// Los valores salen de los tokens de la referencia North Scale (app/north.css).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  corePlugins: {
    // La clase .container la define north.css con su propio ancho máximo.
    container: false,
  },
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        "bg-3": "var(--bg-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        mute: "var(--mute)",
        accent: "var(--accent)",
        brand: "var(--brand-blue)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        danger: "#ff8a8a",
        warn: "#ffd166",
      },
      fontFamily: {
        sans: ["var(--sans)"],
        serif: ["var(--serif)"],
        mono: ["var(--mono)"],
      },
      borderRadius: {
        card: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
