/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edfff4',
          100: '#d5ffe4',
          200: '#aeffcb',
          300: '#6fffa3',
          400: '#29f573',
          500: '#00dc52',
          600: '#00c358',  // Primary brand green
          700: '#008f3e',
          800: '#067034',
          900: '#085c2d',
          950: '#003416',
        },
        slate: {
          850: '#172033',
          950: '#0b1120',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
