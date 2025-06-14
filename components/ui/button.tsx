import React from 'react'
import { LucideIcon } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
  children: React.ReactNode
}

const variantStyles = {
  primary: 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border-indigo-600/30',
  secondary: 'bg-slate-800/50 text-white hover:bg-slate-800/70 border-slate-700',
  success: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-emerald-600/30',
  danger: 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border-red-600/30',
  warning: 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border-amber-600/30',
  ghost: 'text-gray-400 hover:text-white hover:bg-slate-800/30'
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg'
}

export function Button({ 
  variant = 'secondary', 
  size = 'md', 
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props 
}: ButtonProps) {
  const isDisabled = disabled || loading
  
  return (
    <button
      disabled={isDisabled}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${variant !== 'ghost' ? 'border' : ''}
        rounded-lg transition-all duration-200
        inline-flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {loading && (
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      )}
      {!loading && Icon && iconPosition === 'left' && <Icon className="h-4 w-4" />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className="h-4 w-4" />}
    </button>
  )
}