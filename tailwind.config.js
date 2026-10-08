/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F4FBF9',
          100: '#E6F7F3',
          400: '#2DD4BF',
          500: '#0D9488',
          600: '#0F766E',
          700: '#115E59',
          900: '#134E48',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          primary: '#0d9488',
          dark: '#0f766e',
          glow: 'rgba(13, 148, 136, 0.15)',
        },
        coral: {
          400: '#FB7185',
          500: '#F97316',
          600: '#EA580C',
        },
        surface: {
          base: '#F1F3F6',
          card: '#FFFFFF',
          dark: '#16191E',
        },
        slate: {
          700: '#334155',
          800: '#1e293b',
          850: '#111827',
          900: '#0f172a',
          950: '#080d1a',
        },
        canvas: '#F4F5F8',
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(0, 0, 0, 0.04)',
        'float': '0 18px 45px rgba(15, 23, 42, 0.08)',
        'pill': '0 4px 14px rgba(13, 148, 136, 0.25)',
        'pill-active': '0 6px 20px rgba(13, 148, 136, 0.35)',
        'bento': '0 8px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'bento-hover': '0 14px 40px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03)',
        'floating-sidebar': '0 10px 40px rgba(15, 23, 42, 0.04)',
        'card': '0 18px 40px -12px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        '2xl': '20px',
        '2.5xl': '1.25rem',
        '3xl': '28px',
        '4xl': '36px',
        '5xl': '40px',
        'pill': '9999px',
      }
    },
  },
  plugins: [],
}
