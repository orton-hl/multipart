/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        ink: {
          950: '#060a0f', 900: '#0b0f14', 800: '#111720',
          700: '#161e2a', 600: '#1f2d3d', 500: '#2a3f56',
          400: '#3d5a78', 300: '#5a7490', 200: '#8faab8',
          100: '#c2d4df', 50:  '#e8f0f5',
        },
        azure:  { DEFAULT: '#00d4ff', dim: '#0099cc' },
        jade:   { DEFAULT: '#7fffb2', dim: '#3db870' },
        amber:  { DEFAULT: '#ffd166', dim: '#cc9900' },
        coral:  { DEFAULT: '#ff6b35' },
        danger: { DEFAULT: '#ff4757' },
      },
      keyframes: {
        fadeUp:     { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer:    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing:  { '0%,100%': { opacity: 0.3, transform: 'scale(1)' }, '50%': { opacity: 1, transform: 'scale(1.05)' } },
        slideIn:    { from: { transform: 'translateX(-8px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
      },
      animation: {
        'fade-up':    'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'shimmer':    'shimmer 2s linear infinite',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
        'slide-in':   'slideIn 0.3s ease forwards',
      },
    },
  },
  plugins: [],
}
