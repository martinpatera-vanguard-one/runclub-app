/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: "#0096c7",
        "accent-dark": "#007aa3",
      },
      borderRadius: {
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
