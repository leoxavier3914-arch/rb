import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 4%)",
        surface: {
          DEFAULT: "hsl(222 47% 11%)",
          accent: "hsl(222 63% 18%)",
        },
        primary: {
          DEFAULT: "hsl(183 72% 48%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(225 28% 15%)",
          foreground: "hsl(215 20% 65%)",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 30px -12px hsl(183 72% 40% / 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
