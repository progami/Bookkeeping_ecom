'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface EnhancedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
  ripple?: boolean
}

export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      loading = false,
      ripple = true,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Ripple effect
      if (ripple && !disabled && !loading) {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const rippleElement = document.createElement('span')
        const size = Math.max(rect.width, rect.height)
        const x = e.clientX - rect.left - size / 2
        const y = e.clientY - rect.top - size / 2

        rippleElement.style.width = rippleElement.style.height = size + 'px'
        rippleElement.style.left = x + 'px'
        rippleElement.style.top = y + 'px'
        rippleElement.classList.add('ripple')

        button.appendChild(rippleElement)

        setTimeout(() => {
          rippleElement.remove()
        }, 600)
      }

      if (onClick && !disabled && !loading) {
        onClick(e)
      }
    }

    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
      secondary: 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus:ring-slate-500',
      ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 focus:ring-slate-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-base gap-2',
      lg: 'px-6 py-3 text-lg gap-3'
    }

    const iconSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    }

    return (
      <button
        ref={ref}
        className={cn(
          'relative overflow-hidden inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-200 transform',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-inherit">
            <span className="loading-spinner" />
          </span>
        )}
        
        <span className={cn('flex items-center gap-2', loading && 'opacity-0')}>
          {Icon && iconPosition === 'left' && (
            <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
          )}
          {children}
          {Icon && iconPosition === 'right' && (
            <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
          )}
        </span>

        <style jsx>{`
          .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
          }

          @keyframes ripple-animation {
            to {
              transform: scale(4);
              opacity: 0;
            }
          }
        `}</style>
      </button>
    )
  }
)

EnhancedButton.displayName = 'EnhancedButton'