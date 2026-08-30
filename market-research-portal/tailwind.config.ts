import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7fb',
          100: '#e2edf6',
          200: '#c1d9ec',
          300: '#8fbadb',
          400: '#5896c4',
          500: '#3679aa',
          600: '#28608c',
          700: '#224e72',
          800: '#20425f',
          900: '#1e3851',
          950: '#132436',
        },
      },
    },
  },
  plugins: [],
};

export default config;
