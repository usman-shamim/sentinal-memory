/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brain: {
          bg: '#050505',
          surface: '#0a0a0a',
          border: '#1f1f1f',
          cyan: '#00d9ff',
          purple: '#9d4edd',
          muted: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
