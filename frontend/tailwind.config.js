/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,jsx}',
    './public/index.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        brand: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
        telemetry: ['Chakra Petch', 'monospace', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
