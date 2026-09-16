/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        dusk: "rgb(21 16 48 / <alpha-value>)",
        panel: "rgb(42 33 88 / <alpha-value>)",
        parchment: "rgb(244 239 230 / <alpha-value>)",
        lamp: "rgb(232 163 61 / <alpha-value>)",
        starlight: "rgb(124 147 201 / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        pageIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "page-in": "pageIn 400ms ease-out",
      },
    },
  },
  plugins: [],
};
