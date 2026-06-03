/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Sleek dark slate
        foreground: "#fafafa",
        card: {
          DEFAULT: "rgba(20, 20, 23, 0.65)", // Glass effect background
          border: "rgba(255, 255, 255, 0.08)",
        },
        primary: {
          DEFAULT: "#6366f1", // Vibrant Indigo
          hover: "#4f46e5",
        },
        secondary: {
          DEFAULT: "#14b8a6", // Teal
          hover: "#0d9488",
        },
        accent: {
          DEFAULT: "#ec4899", // Pink
          purple: "#a855f7",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        premium: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        indigo: "0 0 25px -5px rgba(99, 102, 241, 0.15)",
        teal: "0 0 25px -5px rgba(20, 184, 166, 0.15)",
      },
    },
  },
  plugins: [],
}
