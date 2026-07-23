/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))', card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' }, primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' }, secondary: 'hsl(var(--secondary))', muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' }, accent: 'hsl(var(--accent))', border: 'hsl(var(--border))', destructive: 'hsl(var(--destructive))', success: 'hsl(var(--success))', price: 'hsl(var(--price))' }, fontFamily: { sans: ['Manrope', 'Segoe UI', 'sans-serif'], display: ['Georgia', 'serif'] }, borderRadius: { xl: 'var(--radius)' }, boxShadow: { soft: 'var(--shadow-soft)', lift: 'var(--shadow-lift)' } } },
  plugins: []
};
