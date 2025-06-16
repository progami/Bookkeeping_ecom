'use client'

import React, { forwardRef } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
  ripple?: boolean
  children: React.ReactNode
}

const variantStyles = {
  primary: 'bg-brand-emerald text-white hover:bg-brand-emerald-dark focus:ring-brand-emerald border-transparent',
  secondary: 'bg-secondary text-white hover:bg-tertiary border-default focus:ring-border-light',
  success: 'bg-brand-emerald text-brand-emerald hover:bg-brand-emerald/20 border-brand-emerald focus:ring-brand-emerald',
  danger: 'bg-brand-red text-brand-red hover:bg-brand-red/20 border-brand-red focus:ring-brand-red',
  warning: 'bg-brand-amber text-brand-amber hover:bg-brand-amber/20 border-brand-amber focus:ring-brand-amber',
  ghost: 'text-tertiary hover:text-primary hover:bg-tertiary border-transparent focus:ring-border-light'
}

const sizeStyles = {
  sm: 'px-3 py-2.5 text-sm gap-1.5 min-h-[44px]', // Meet touch target
  md: 'px-4 py-3 text-base gap-2 min-h-[48px]',
  lg: 'px-6 py-4 text-lg gap-3 min-h-[56px]'
}

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'secondary', 
    size = 'md', 
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    ripple = true,
    disabled = false,
    children,
    className = '',
    onClick,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Ripple effect
      if (ripple && !isDisabled) {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const rippleElement = document.createElement('span')
        const size = Math.max(rect.width, rect.height)
        const x = e.clientX - rect.left - size / 2
        const y = e.clientY - rect.top - size / 2

        rippleElement.style.width = rippleElement.style.height = size + 'px'
        rippleElement.style.left = x + 'px'
        rippleElement.style.top = y + 'px'
        rippleElement.classList.add('button-ripple')

        button.appendChild(rippleElement)

        setTimeout(() => {
          rippleElement.remove()
        }, 600)
      }

      if (onClick && !isDisabled) {
        onClick(e)
      }
    }
    
    return (
      <>
        <button
          ref={ref}
          disabled={isDisabled}
          className={cn(
            'relative overflow-hidden inline-flex items-center justify-center font-medium',
            'rounded-lg transition-all duration-200 transform border',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'active:scale-95',
            variantStyles[variant],
            sizeStyles[size],
            className
          )}
          onClick={handleClick}
          {...props}
        >
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-inherit">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            </span>
          )}
          
          <span className={cn('inline-flex items-center', loading && 'opacity-0')}>
            {!loading && Icon && iconPosition === 'left' && (
              <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
            )}
            {children}
            {!loading && Icon && iconPosition === 'right' && (
              <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
            )}
          </span>
        </button>
        
        <style jsx global>{`
          .button-ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: button-ripple-animation 0.6s ease-out;
            pointer-events: none;
          }

          @keyframes button-ripple-animation {
            to {
              transform: scale(4);
              opacity: 0;
            }
          }
        `}</style>
      </>
    )
  }
)

Button.displayName = 'Button'