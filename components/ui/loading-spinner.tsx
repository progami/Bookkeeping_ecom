import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

const sizeStyles = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20'
}

const variantStyles = {
  default: 'border-slate-500',
  primary: 'border-indigo-500',
  success: 'border-emerald-500',
  warning: 'border-amber-500',
  danger: 'border-red-500'
}

export function LoadingSpinner({ size = 'md', variant = 'success' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
      <div className="relative">
        <div className={`${sizeStyles[size]} border-4 ${variantStyles[variant]}/20 rounded-full animate-pulse`} />
        <div className={`absolute inset-0 ${sizeStyles[size]} border-4 ${variantStyles[variant]} border-t-transparent rounded-full animate-spin`} />
      </div>
    </div>
  )
}