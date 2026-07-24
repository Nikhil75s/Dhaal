/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#111827',
          900: '#0B1120'
        },
        critical: '#EF4444',
        warning: '#F59E0B',
        clear: '#10B981',
        khaki: '#D4AF37',
        'police-blue': '#3B82F6'
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'sans-serif']
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite'
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '50%': { opacity: '0.5' },
          '100%': { transform: 'scale(2.5)', opacity: '0' }
        }
      }
    }
  },
  plugins: [],
}
