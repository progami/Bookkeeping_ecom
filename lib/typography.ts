/**
 * Typography System - Consistent font sizes and hierarchies
 * 
 * This system provides:
 * - Consistent type scale across the app
 * - Semantic naming for better DX
 * - Responsive font sizes
 * - Line height and letter spacing defaults
 */

// Type scale - uses a 1.25 ratio (Major Third)
export const fontSize = {
  // Text sizes
  xs: 'text-xs',      // 12px
  sm: 'text-sm',      // 14px
  base: 'text-base',  // 16px
  lg: 'text-lg',      // 18px
  xl: 'text-xl',      // 20px
  
  // Heading sizes
  h6: 'text-xl',      // 20px
  h5: 'text-2xl',     // 24px
  h4: 'text-3xl',     // 30px
  h3: 'text-4xl',     // 36px
  h2: 'text-5xl',     // 48px
  h1: 'text-6xl',     // 60px
} as const

// Font weights
export const fontWeight = {
  normal: 'font-normal',     // 400
  medium: 'font-medium',     // 500
  semibold: 'font-semibold', // 600
  bold: 'font-bold',         // 700
} as const

// Line heights
export const lineHeight = {
  tight: 'leading-tight',       // 1.25
  snug: 'leading-snug',        // 1.375
  normal: 'leading-normal',    // 1.5
  relaxed: 'leading-relaxed',  // 1.625
  loose: 'leading-loose',      // 2
} as const

// Letter spacing
export const letterSpacing = {
  tighter: 'tracking-tighter', // -0.05em
  tight: 'tracking-tight',     // -0.025em
  normal: 'tracking-normal',   // 0
  wide: 'tracking-wide',       // 0.025em
  wider: 'tracking-wider',     // 0.05em
  widest: 'tracking-widest',   // 0.1em
} as const

// Text colors
export const textColor = {
  // Primary text colors
  primary: 'text-white',
  secondary: 'text-gray-300',
  tertiary: 'text-gray-400',
  muted: 'text-gray-500',
  
  // Semantic colors
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  
  // Interactive
  link: 'text-blue-400 hover:text-blue-300',
  linkHover: 'hover:text-white',
} as const

// Typography components with consistent styles
export const typography = {
  // Headings
  h1: `${fontSize.h1} ${fontWeight.bold} ${lineHeight.tight} ${textColor.primary}`,
  h2: `${fontSize.h2} ${fontWeight.bold} ${lineHeight.tight} ${textColor.primary}`,
  h3: `${fontSize.h3} ${fontWeight.bold} ${lineHeight.snug} ${textColor.primary}`,
  h4: `${fontSize.h4} ${fontWeight.semibold} ${lineHeight.snug} ${textColor.primary}`,
  h5: `${fontSize.h5} ${fontWeight.semibold} ${lineHeight.normal} ${textColor.primary}`,
  h6: `${fontSize.h6} ${fontWeight.semibold} ${lineHeight.normal} ${textColor.primary}`,
  
  // Body text
  body: `${fontSize.base} ${fontWeight.normal} ${lineHeight.relaxed} ${textColor.secondary}`,
  bodySmall: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.relaxed} ${textColor.secondary}`,
  bodyLarge: `${fontSize.lg} ${fontWeight.normal} ${lineHeight.relaxed} ${textColor.secondary}`,
  
  // Special text
  caption: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.tertiary}`,
  overline: `${fontSize.xs} ${fontWeight.medium} ${letterSpacing.wider} uppercase ${textColor.muted}`,
  label: `${fontSize.sm} ${fontWeight.medium} ${lineHeight.normal} ${textColor.secondary}`,
  
  // Interactive
  link: `${fontSize.base} ${fontWeight.normal} ${textColor.link} underline decoration-blue-400/30 hover:decoration-blue-400 transition-colors`,
  button: `${fontSize.base} ${fontWeight.medium} ${letterSpacing.wide}`,
  
  // Data display
  number: `${fontSize.base} ${fontWeight.medium} font-mono ${textColor.primary}`,
  numberLarge: `${fontSize.h4} ${fontWeight.bold} font-mono ${textColor.primary}`,
  code: `${fontSize.sm} ${fontWeight.normal} font-mono ${textColor.secondary} bg-slate-800/50 px-1.5 py-0.5 rounded`,
} as const

// Responsive typography utilities
export const responsiveText = {
  h1: 'text-4xl md:text-5xl lg:text-6xl',
  h2: 'text-3xl md:text-4xl lg:text-5xl',
  h3: 'text-2xl md:text-3xl lg:text-4xl',
  h4: 'text-xl md:text-2xl lg:text-3xl',
  h5: 'text-lg md:text-xl lg:text-2xl',
  h6: 'text-base md:text-lg lg:text-xl',
} as const

// Page title component classes
export const pageTitle = {
  container: 'mb-8',
  title: `${responsiveText.h3} ${fontWeight.bold} ${lineHeight.tight} ${textColor.primary} mb-2`,
  subtitle: `${fontSize.lg} ${fontWeight.normal} ${lineHeight.normal} ${textColor.tertiary}`,
} as const

// Card header component classes  
export const cardHeader = {
  title: `${fontSize.h6} ${fontWeight.semibold} ${lineHeight.tight} ${textColor.primary}`,
  subtitle: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.tertiary} mt-1`,
} as const

// Table typography
export const table = {
  header: `${fontSize.sm} ${fontWeight.medium} ${letterSpacing.wider} uppercase ${textColor.muted}`,
  cell: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.secondary}`,
  cellImportant: `${fontSize.sm} ${fontWeight.medium} ${lineHeight.normal} ${textColor.primary}`,
} as const

// Form typography
export const form = {
  label: `${fontSize.sm} ${fontWeight.medium} ${lineHeight.normal} ${textColor.secondary} mb-1.5`,
  input: `${fontSize.base} ${fontWeight.normal} ${textColor.primary}`,
  helper: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.tertiary} mt-1.5`,
  error: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.error} mt-1.5`,
} as const

// Metric display
export const metric = {
  value: `${fontSize.h3} ${fontWeight.bold} ${lineHeight.tight} ${textColor.primary}`,
  label: `${fontSize.sm} ${fontWeight.normal} ${lineHeight.normal} ${textColor.tertiary} mt-1`,
  trend: `${fontSize.xs} ${fontWeight.medium} ${lineHeight.normal}`,
} as const

// Badge/Tag typography
export const badge = {
  small: `${fontSize.xs} ${fontWeight.medium} ${letterSpacing.wide} px-2 py-0.5 rounded`,
  medium: `${fontSize.sm} ${fontWeight.medium} ${letterSpacing.normal} px-2.5 py-1 rounded`,
  large: `${fontSize.base} ${fontWeight.medium} ${letterSpacing.normal} px-3 py-1.5 rounded-lg`,
} as const