/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        violet: {
          primary: '#533AB7',
          dark: '#3C2A8A',
          light: '#EDE9FF',
        }
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)'],
        display: ['var(--font-syne)'],
      }
    },
  },
  plugins: [],
}
