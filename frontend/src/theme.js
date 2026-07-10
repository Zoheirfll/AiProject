// Single source of truth for design tokens — mirrored into CSS custom
// properties in index.css (for Tailwind utility classes) and importable
// directly in JS (for Recharts colors, inline styles, canvas, etc.).

export const colors = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  success: { bg: '#ecfdf5', text: '#047857', ring: '#a7f3d0', solid: '#10b981' },
  warning: { bg: '#fffbeb', text: '#b45309', ring: '#fde68a', solid: '#f59e0b' },
  danger: { bg: '#fef2f2', text: '#b91c1c', ring: '#fecaca', solid: '#ef4444' },
  neutral: { bg: '#f1f5f9', text: '#475569', ring: '#e2e8f0', solid: '#94a3b8' },
}

export const statusTone = {
  SENT: 'success',
  SUCCESS: 'success',
  DRAFT: 'warning',
  PENDING: 'warning',
  FAILED: 'danger',
}

export const radii = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
}

export const shadows = {
  card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
  raised: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
  overlay: '0 20px 40px -8px rgb(15 23 42 / 0.25)',
}

export const chartPalette = [
  colors.primary[500],
  colors.success.solid,
  colors.warning.solid,
  colors.danger.solid,
  colors.primary[300],
  colors.slate[400],
]
