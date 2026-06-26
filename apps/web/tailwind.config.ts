import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ─── Brand color palette (cosmic dark theme) ───────────────────
      colors: {
        // Deep space background
        space: {
          950: '#03040a',
          900: '#070b14',
          800: '#0d1526',
          700: '#121e38',
          600: '#1a2d52',
          500: '#24406e',
          400: '#2e5490',
        },
        // Nebula accent (electric blue/cyan)
        nebula: {
          50: '#e8f8ff',
          100: '#d1f1ff',
          200: '#a2e3ff',
          300: '#64d4ff',
          400: '#20c4ff',
          500: '#00aaff',
          600: '#0088dd',
          700: '#006bb4',
          800: '#005494',
          900: '#003d6e',
        },
        // Stellar accent (warm gold/amber)
        stellar: {
          50: '#fff9eb',
          100: '#ffefc7',
          200: '#ffdd8a',
          300: '#ffc84d',
          400: '#ffb520',
          500: '#f99500',
          600: '#dc7000',
          700: '#b64c00',
          800: '#933b04',
          900: '#793108',
        },
        // Aurora accent (green)
        aurora: {
          400: '#34e89e',
          500: '#0f9b58',
        },
        // Alert colors
        cosmos: {
          red: '#ff4757',
          orange: '#ff6b35',
          yellow: '#ffd32a',
        },
      },

      // ─── Typography ─────────────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-jetbrains-mono)', ...defaultTheme.fontFamily.mono],
        display: ['var(--font-outfit)', ...defaultTheme.fontFamily.sans],
      },

      // ─── Background gradients ────────────────────────────────────────
      backgroundImage: {
        'space-gradient': 'radial-gradient(ellipse at top, #121e38 0%, #03040a 70%)',
        'nebula-glow':
          'radial-gradient(circle at center, rgba(0,170,255,0.15) 0%, transparent 60%)',
        'stellar-glow':
          'radial-gradient(circle at center, rgba(255,165,0,0.12) 0%, transparent 60%)',
        'sidebar-gradient': 'linear-gradient(180deg, #0d1526 0%, #070b14 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(13,21,38,0.9) 0%, rgba(7,11,20,0.95) 100%)',
        'aurora-gradient': 'linear-gradient(90deg, #0f9b58 0%, #34e89e 100%)',
      },

      // ─── Animations ──────────────────────────────────────────────────
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        orbit: 'orbit 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(0,170,255,0.3), 0 0 20px rgba(0,170,255,0.1)' },
          to: { boxShadow: '0 0 20px rgba(0,170,255,0.6), 0 0 40px rgba(0,170,255,0.2)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' },
          to: { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' },
        },
      },

      // ─── Box shadows ──────────────────────────────────────────────────
      boxShadow: {
        nebula: '0 0 20px rgba(0,170,255,0.25), 0 4px 24px rgba(0,0,0,0.4)',
        'nebula-lg': '0 0 40px rgba(0,170,255,0.3), 0 8px 40px rgba(0,0,0,0.5)',
        stellar: '0 0 20px rgba(255,165,0,0.25), 0 4px 24px rgba(0,0,0,0.4)',
        card: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-blue': '0 0 30px rgba(0,170,255,0.4)',
        'glow-gold': '0 0 30px rgba(255,165,0,0.4)',
      },

      // ─── Border radius ───────────────────────────────────────────────
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      // ─── Backdrop blur ───────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
