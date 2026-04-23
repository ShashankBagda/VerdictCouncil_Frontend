import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0d1520',
          900: '#1a2332',
          800: '#2d3a47',
          700: '#40485c',
          600: '#535970',
          500: '#6b7280',
        },
        teal: {
          400: '#22d3ee',
          500: '#0ea5e9',
          600: '#06b6d4',
          700: '#0891b2',
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 12px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 28px rgba(0, 0, 0, 0.15)',
        xl: '0 20px 40px rgba(0, 0, 0, 0.2)',
        'glow-teal': '0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.15)',
        'glow-gold': '0 0 20px rgba(251, 191, 36, 0.4), 0 0 40px rgba(251, 191, 36, 0.15)',
        'glow-violet': '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.15)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(1deg)' },
          '66%': { transform: 'translateY(-4px) rotate(-1deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.7)' },
          '50%': { opacity: '0.9', boxShadow: '0 0 0 12px rgba(6, 182, 212, 0)' },
        },
        'pulse-glow-gold': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)' },
          '50%': { boxShadow: '0 0 24px rgba(251, 191, 36, 0.9), 0 0 48px rgba(251, 191, 36, 0.4)' },
        },
        'agent-pulse': {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.8)' },
          '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(6, 182, 212, 0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(6, 182, 212, 0)' },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' },
        },
        'particle-drift': {
          '0%': { transform: 'translateY(0) translateX(0) scale(1)', opacity: '0.6' },
          '50%': { transform: 'translateY(-30px) translateX(10px) scale(1.2)', opacity: '1' },
          '100%': { transform: 'translateY(0) translateX(0) scale(1)', opacity: '0.6' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '75%, 100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(-2px)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
          '50%': { transform: 'translateY(0px)', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'number-tick': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease forwards',
        'slide-up': 'slide-up 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-left': 'slide-in-left 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in': 'scale-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s infinite',
        'pulse-glow-gold': 'pulse-glow-gold 2s ease-in-out infinite',
        'agent-pulse': 'agent-pulse 1.8s ease-out infinite',
        'orbit': 'orbit 8s linear infinite',
        'particle-drift': 'particle-drift 5s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'ping-slow': 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'number-tick': 'number-tick 300ms ease forwards',
      },
      maxWidth: {
        container: '1440px',
      },
    },
  },
  plugins: [typography],
}
