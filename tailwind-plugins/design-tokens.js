const plugin = require('tailwindcss/plugin')

// Import design tokens
const designTokens = require('../lib/design-tokens.ts')

module.exports = plugin(function({ addBase, addComponents, addUtilities, theme }) {
  // Add CSS variables for design tokens
  addBase({
    ':root': {
      // Background colors
      '--bg-primary': designTokens.colors.background.primary,
      '--bg-secondary': designTokens.colors.background.secondary,
      '--bg-tertiary': designTokens.colors.background.tertiary,
      '--bg-elevated': designTokens.colors.background.elevated,
      
      // Text colors
      '--text-primary': designTokens.colors.text.primary,
      '--text-secondary': designTokens.colors.text.secondary,
      '--text-tertiary': designTokens.colors.text.tertiary,
      '--text-muted': designTokens.colors.text.muted,
      
      // Brand colors
      '--brand-emerald': designTokens.colors.brand.emerald.DEFAULT,
      '--brand-emerald-light': designTokens.colors.brand.emerald.light,
      '--brand-emerald-dark': designTokens.colors.brand.emerald.dark,
      '--brand-emerald-bg': designTokens.colors.brand.emerald.bg,
      '--brand-emerald-border': designTokens.colors.brand.emerald.border,
      
      '--brand-blue': designTokens.colors.brand.blue.DEFAULT,
      '--brand-blue-light': designTokens.colors.brand.blue.light,
      '--brand-blue-dark': designTokens.colors.brand.blue.dark,
      '--brand-blue-bg': designTokens.colors.brand.blue.bg,
      '--brand-blue-border': designTokens.colors.brand.blue.border,
      
      '--brand-purple': designTokens.colors.brand.purple.DEFAULT,
      '--brand-purple-light': designTokens.colors.brand.purple.light,
      '--brand-purple-dark': designTokens.colors.brand.purple.dark,
      '--brand-purple-bg': designTokens.colors.brand.purple.bg,
      '--brand-purple-border': designTokens.colors.brand.purple.border,
      
      '--brand-amber': designTokens.colors.brand.amber.DEFAULT,
      '--brand-amber-light': designTokens.colors.brand.amber.light,
      '--brand-amber-dark': designTokens.colors.brand.amber.dark,
      '--brand-amber-bg': designTokens.colors.brand.amber.bg,
      '--brand-amber-border': designTokens.colors.brand.amber.border,
      
      '--brand-red': designTokens.colors.brand.red.DEFAULT,
      '--brand-red-light': designTokens.colors.brand.red.light,
      '--brand-red-dark': designTokens.colors.brand.red.dark,
      '--brand-red-bg': designTokens.colors.brand.red.bg,
      '--brand-red-border': designTokens.colors.brand.red.border,
      
      // Status colors
      '--status-success': designTokens.colors.status.success,
      '--status-warning': designTokens.colors.status.warning,
      '--status-error': designTokens.colors.status.error,
      '--status-info': designTokens.colors.status.info,
      
      // Border colors
      '--border-default': designTokens.colors.border.DEFAULT,
      '--border-light': designTokens.colors.border.light,
      '--border-dark': designTokens.colors.border.dark,
      
      // Animation
      '--duration-fast': designTokens.animation.duration.fast,
      '--duration-normal': designTokens.animation.duration.normal,
      '--duration-slow': designTokens.animation.duration.slow,
      '--easing-default': designTokens.animation.easing.default,
      '--easing-in': designTokens.animation.easing.in,
      '--easing-out': designTokens.animation.easing.out,
      '--easing-in-out': designTokens.animation.easing.inOut,
    }
  })
  
  // Add utility classes for design tokens
  addUtilities({
    // Background utilities
    '.bg-primary': { backgroundColor: 'var(--bg-primary)' },
    '.bg-secondary': { backgroundColor: 'var(--bg-secondary)' },
    '.bg-tertiary': { backgroundColor: 'var(--bg-tertiary)' },
    '.bg-elevated': { backgroundColor: 'var(--bg-elevated)' },
    
    // Text utilities
    '.text-primary': { color: 'var(--text-primary)' },
    '.text-secondary': { color: 'var(--text-secondary)' },
    '.text-tertiary': { color: 'var(--text-tertiary)' },
    '.text-muted': { color: 'var(--text-muted)' },
    
    // Brand color utilities
    '.text-brand-emerald': { color: 'var(--brand-emerald)' },
    '.text-brand-blue': { color: 'var(--brand-blue)' },
    '.text-brand-purple': { color: 'var(--brand-purple)' },
    '.text-brand-amber': { color: 'var(--brand-amber)' },
    '.text-brand-red': { color: 'var(--brand-red)' },
    
    '.bg-brand-emerald': { backgroundColor: 'var(--brand-emerald-bg)' },
    '.bg-brand-blue': { backgroundColor: 'var(--brand-blue-bg)' },
    '.bg-brand-purple': { backgroundColor: 'var(--brand-purple-bg)' },
    '.bg-brand-amber': { backgroundColor: 'var(--brand-amber-bg)' },
    '.bg-brand-red': { backgroundColor: 'var(--brand-red-bg)' },
    
    '.border-brand-emerald': { borderColor: 'var(--brand-emerald-border)' },
    '.border-brand-blue': { borderColor: 'var(--brand-blue-border)' },
    '.border-brand-purple': { borderColor: 'var(--brand-purple-border)' },
    '.border-brand-amber': { borderColor: 'var(--brand-amber-border)' },
    '.border-brand-red': { borderColor: 'var(--brand-red-border)' },
    
    // Status utilities
    '.text-status-success': { color: 'var(--status-success)' },
    '.text-status-warning': { color: 'var(--status-warning)' },
    '.text-status-error': { color: 'var(--status-error)' },
    '.text-status-info': { color: 'var(--status-info)' },
    
    // Border utilities
    '.border-default': { borderColor: 'var(--border-default)' },
    '.border-light': { borderColor: 'var(--border-light)' },
    '.border-dark': { borderColor: 'var(--border-dark)' },
    
    // Animation utilities
    '.duration-fast': { transitionDuration: 'var(--duration-fast)' },
    '.duration-normal': { transitionDuration: 'var(--duration-normal)' },
    '.duration-slow': { transitionDuration: 'var(--duration-slow)' },
    '.ease-default': { transitionTimingFunction: 'var(--easing-default)' },
    '.ease-in': { transitionTimingFunction: 'var(--easing-in)' },
    '.ease-out': { transitionTimingFunction: 'var(--easing-out)' },
    '.ease-in-out': { transitionTimingFunction: 'var(--easing-in-out)' },
  })
  
  // Add component classes
  addComponents({
    // Card component using design tokens
    '.card': {
      backgroundColor: 'var(--bg-secondary)',
      borderColor: 'var(--border-default)',
      borderWidth: '1px',
      borderRadius: theme('borderRadius.lg'),
      padding: theme('spacing.6'),
    },
    
    // Button base using design tokens
    '.btn': {
      padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
      borderRadius: theme('borderRadius.lg'),
      fontWeight: theme('fontWeight.medium'),
      transitionProperty: 'all',
      transitionDuration: 'var(--duration-normal)',
      transitionTimingFunction: 'var(--easing-default)',
    },
    
    // Typography classes using design tokens
    '.text-xs': { fontSize: designTokens.typography.fontSize.xs, lineHeight: designTokens.typography.lineHeight.normal },
    '.text-sm': { fontSize: designTokens.typography.fontSize.sm, lineHeight: designTokens.typography.lineHeight.normal },
    '.text-base': { fontSize: designTokens.typography.fontSize.base, lineHeight: designTokens.typography.lineHeight.normal },
    '.text-lg': { fontSize: designTokens.typography.fontSize.lg, lineHeight: designTokens.typography.lineHeight.normal },
    '.text-xl': { fontSize: designTokens.typography.fontSize.xl, lineHeight: designTokens.typography.lineHeight.snug },
    '.text-2xl': { fontSize: designTokens.typography.fontSize['2xl'], lineHeight: designTokens.typography.lineHeight.snug },
    '.text-3xl': { fontSize: designTokens.typography.fontSize['3xl'], lineHeight: designTokens.typography.lineHeight.tight },
    '.text-4xl': { fontSize: designTokens.typography.fontSize['4xl'], lineHeight: designTokens.typography.lineHeight.tight },
    '.text-5xl': { fontSize: designTokens.typography.fontSize['5xl'], lineHeight: designTokens.typography.lineHeight.tight },
  })
}, {
  // Extend theme with design tokens
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
        },
        brand: {
          emerald: {
            DEFAULT: 'var(--brand-emerald)',
            light: 'var(--brand-emerald-light)',
            dark: 'var(--brand-emerald-dark)',
            bg: 'var(--brand-emerald-bg)',
            border: 'var(--brand-emerald-border)',
          },
          blue: {
            DEFAULT: 'var(--brand-blue)',
            light: 'var(--brand-blue-light)',
            dark: 'var(--brand-blue-dark)',
            bg: 'var(--brand-blue-bg)',
            border: 'var(--brand-blue-border)',
          },
          purple: {
            DEFAULT: 'var(--brand-purple)',
            light: 'var(--brand-purple-light)',
            dark: 'var(--brand-purple-dark)',
            bg: 'var(--brand-purple-bg)',
            border: 'var(--brand-purple-border)',
          },
          amber: {
            DEFAULT: 'var(--brand-amber)',
            light: 'var(--brand-amber-light)',
            dark: 'var(--brand-amber-dark)',
            bg: 'var(--brand-amber-bg)',
            border: 'var(--brand-amber-border)',
          },
          red: {
            DEFAULT: 'var(--brand-red)',
            light: 'var(--brand-red-light)',
            dark: 'var(--brand-red-dark)',
            bg: 'var(--brand-red-bg)',
            border: 'var(--brand-red-border)',
          },
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error: 'var(--status-error)',
          info: 'var(--status-info)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          light: 'var(--border-light)',
          dark: 'var(--border-dark)',
        },
      },
      spacing: designTokens.spacing,
      fontSize: designTokens.typography.fontSize,
      fontWeight: designTokens.typography.fontWeight,
      lineHeight: designTokens.typography.lineHeight,
    }
  }
})