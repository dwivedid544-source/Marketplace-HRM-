/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB', // Primary Blue
          dark: '#1D4ED8',
          light: '#60A5FA',
        },
        indigo: {
          DEFAULT: '#4F46E5', // Indigo
          dark: '#4338CA',
          light: '#818CF8',
        },
        accent: {
          DEFAULT: '#06B6D4', // Cyan Accent
          dark: '#0891B2',
          light: '#22D3EE',
        },
        slate: {
          dark: '#0F172A', // Dark Slate
          secondary: '#1E293B', // Secondary Dark
          border: '#E2E8F0', // Border
          light: '#F8FAFC', // Light Background
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        },
        // Legacy aliases to prevent UI breakage
        navy: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
          dark: '#020617',
        },
        secondary: {
          DEFAULT: '#06B6D4',
          dark: '#0891B2',
          light: '#22D3EE',
        },
        background: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
        dashboard: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'premium-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2563EB, #06B6D4)',
        'gradient-indigo': 'linear-gradient(135deg, #4F46E5, #06B6D4)',
        'gradient-dark': 'linear-gradient(135deg, #0F172A, #1E293B)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100vw)' },
        }
      },
      animation: {
        marquee: 'marquee 35s linear infinite',
      }
    },
  },
  plugins: [],
}
