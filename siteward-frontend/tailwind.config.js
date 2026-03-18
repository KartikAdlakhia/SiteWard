/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#8b5e34", // Warm brown
        "accent": "#d4a373", // Muted peach/tan
        "background-light": "#fdf8f5", // Soft peach white
        "background-dark": "#f4ede8", // Light peach/brown background
        "surface-dark": "#ffffff", // White cards for contrast
        "border-dark": "#e5d5cc", // Soft brown border
        "text-main": "#4a3728", // Deep brown text
        "text-muted": "#8d7b6d", // Muted brown text
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem", 
        "lg": "1rem", 
        "xl": "1.5rem", 
        "full": "9999px"
      },
    },
  },
  plugins: [],
}
