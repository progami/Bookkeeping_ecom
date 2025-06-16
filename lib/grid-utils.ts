import { cn } from './utils'

/**
 * Standardized responsive grid system for consistent layouts across the app
 * Mobile-first approach with breakpoints aligned to our design system
 */

export const gridLayouts = {
  // Cards and metric displays
  cards: {
    // For primary metric cards (4 cards on desktop, 2 on tablet, 1 on mobile)
    metrics: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6',
    
    // For module cards (3 cards on desktop, 2 on tablet, 1 on mobile)
    modules: 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6',
    
    // For feature cards (2 cards on desktop, 1 on mobile)
    features: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    
    // For info cards (3 cards on desktop, 1 on mobile)
    info: 'grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6',
  },
  
  // Form layouts
  forms: {
    // Single column form
    single: 'grid grid-cols-1 gap-6',
    
    // Two column form on desktop
    double: 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6',
    
    // Three column form for complex layouts
    triple: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6',
  },
  
  // Data displays
  data: {
    // Table-like grid (responsive columns)
    table: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4',
    
    // Stats grid (for small stat items)
    stats: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3',
    
    // Key-value pairs
    pairs: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  },
  
  // Dashboard layouts
  dashboard: {
    // Main dashboard grid
    main: 'grid grid-cols-1 lg:grid-cols-3 gap-6',
    
    // Sidebar layout
    sidebar: 'grid grid-cols-1 lg:grid-cols-4 gap-6',
    
    // Analytics grid
    analytics: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6',
  }
}

/**
 * Helper function to get grid class with optional custom gap
 */
export function getGridClass<T extends keyof typeof gridLayouts>(
  type: T,
  layout: keyof typeof gridLayouts[T],
  customGap?: string
): string {
  const layoutGroup = gridLayouts[type] as any
  const baseClass = layoutGroup[layout] || ''
  
  if (customGap) {
    // Replace the gap class with custom one
    return baseClass.replace(/gap-\S+/g, customGap)
  }
  
  return baseClass
}

/**
 * Common gap sizes following 8pt grid
 */
export const gridGaps = {
  xs: 'gap-2',        // 8px
  sm: 'gap-3',        // 12px
  md: 'gap-4',        // 16px
  lg: 'gap-6',        // 24px
  xl: 'gap-8',        // 32px
  
  // Responsive gaps
  responsive: {
    sm: 'gap-2 sm:gap-3 md:gap-4',
    md: 'gap-3 sm:gap-4 md:gap-6',
    lg: 'gap-4 sm:gap-6 md:gap-8',
  }
}

/**
 * Container widths for consistent max-widths
 */
export const containerWidths = {
  xs: 'max-w-xs',      // 320px
  sm: 'max-w-sm',      // 384px
  md: 'max-w-md',      // 448px
  lg: 'max-w-lg',      // 512px
  xl: 'max-w-xl',      // 576px
  '2xl': 'max-w-2xl',  // 672px
  '3xl': 'max-w-3xl',  // 768px
  '4xl': 'max-w-4xl',  // 896px
  '5xl': 'max-w-5xl',  // 1024px
  '6xl': 'max-w-6xl',  // 1152px
  '7xl': 'max-w-7xl',  // 1280px
  full: 'max-w-full',
}