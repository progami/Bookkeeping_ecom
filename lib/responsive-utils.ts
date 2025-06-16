import { cn } from './utils'

/**
 * Responsive text size utility
 * Automatically adjusts text size based on screen size for better readability
 */
export const responsiveText = {
  // Display headings - large titles
  display: {
    1: 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl',
    2: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
    3: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl',
  },
  
  // Page and section headings
  heading: {
    1: 'text-2xl sm:text-3xl md:text-4xl',
    2: 'text-xl sm:text-2xl md:text-3xl',
    3: 'text-lg sm:text-xl md:text-2xl',
    4: 'text-base sm:text-lg md:text-xl',
    5: 'text-sm sm:text-base md:text-lg',
    6: 'text-sm sm:text-base',
  },
  
  // Body text
  body: {
    large: 'text-base sm:text-lg',
    base: 'text-sm sm:text-base',
    small: 'text-xs sm:text-sm',
  },
  
  // UI elements
  ui: {
    button: 'text-sm sm:text-base',
    label: 'text-xs sm:text-sm',
    caption: 'text-xs',
  },
  
  // Numeric displays
  metric: {
    large: 'text-2xl sm:text-3xl md:text-4xl',
    medium: 'text-xl sm:text-2xl md:text-3xl',
    small: 'text-lg sm:text-xl md:text-2xl',
  }
}

/**
 * Helper function to apply responsive text with additional classes
 */
export function getResponsiveTextClass<T extends keyof typeof responsiveText>(
  type: T,
  size: keyof typeof responsiveText[T],
  additionalClasses?: string
): string {
  const textGroup = responsiveText[type] as any
  const textClass = textGroup[size] || ''
  return cn(textClass, additionalClasses)
}

/**
 * Touch target sizes for better mobile accessibility
 * Following WCAG 2.1 AAA standards (44x44px minimum)
 */
export const touchTarget = {
  small: 'min-h-[44px] min-w-[44px] p-3',
  medium: 'min-h-[48px] min-w-[48px] p-4',
  large: 'min-h-[56px] min-w-[56px] p-5',
}

/**
 * Responsive spacing utilities
 */
export const responsiveSpacing = {
  section: {
    y: 'py-6 sm:py-8 md:py-12',
    x: 'px-4 sm:px-6 md:px-8',
  },
  container: {
    padding: 'p-4 sm:p-6 md:p-8',
    margin: 'm-4 sm:m-6 md:m-8',
  },
  gap: {
    small: 'gap-2 sm:gap-3 md:gap-4',
    medium: 'gap-3 sm:gap-4 md:gap-6',
    large: 'gap-4 sm:gap-6 md:gap-8',
  }
}