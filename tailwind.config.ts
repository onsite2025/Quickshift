import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#bdd1ff",
          300: "#8eb1ff",
          400: "#5e87fb",
          500: "#3b62f4",
          600: "#2843e9",
          700: "#1f33d1",
          800: "#1f2da8",
          900: "#1f2c84",
          950: "#171e54",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dde2eb",
          300: "#c0c8d6",
          400: "#8d97ab",
          500: "#5d6884",
          600: "#3f4866",
          700: "#2f3650",
          800: "#1f2438",
          900: "#141826",
          950: "#0a0c16",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 1px 0 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
