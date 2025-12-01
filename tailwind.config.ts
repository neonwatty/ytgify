import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'ytg-red': '#FF0050',
        'ytg-pink': '#FF0080',
        'ytg-purple': '#8B5CF6',
        'ytg-dark': '#0d1117',
        'ytg-black': '#010409',
        'ytg-gray': '#161b22',
        'ytg-border': '#30363d',
        'ytg-gradient-start': '#FF0050',
        'ytg-gradient-mid': '#FF0080',
        'ytg-gradient-end': '#8B5CF6',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'ytg-gradient': 'linear-gradient(135deg, #FF0050 0%, #FF0080 50%, #8B5CF6 100%)',
        'ytg-gradient-reverse': 'linear-gradient(135deg, #8B5CF6 0%, #FF0080 50%, #FF0050 100%)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradient-shift 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 0, 128, 0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 0, 128, 0.8), 0 0 50px rgba(139, 92, 246, 0.4)' },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 20px rgba(255, 0, 128, 0.5)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 40px rgba(255, 0, 128, 0.8)',
          },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(255, 0, 128, 0.5)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.5)',
        'glow-strong': '0 0 40px rgba(255, 0, 128, 0.8)',
      },
    },
  },
  plugins: [],
};
export default config;