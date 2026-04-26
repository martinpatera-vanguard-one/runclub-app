/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: "#FF4500",
        "accent-dark": "#CC3700",
      },
      borderRadius: {
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
