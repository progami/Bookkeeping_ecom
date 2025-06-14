import React from 'react'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick?: () => void
}

const variantStyles = {
  default: {
    container: 'from-slate-600/20 to-slate-600/5 border-slate-600/30 hover:border-slate-500/50',
    icon: 'bg-slate-600/20',
    iconColor: 'text-slate-400',
    trend: 'text-slate-400'
  },
  success: {
    container: 'from-emerald-600/20 to-emerald-600/5 border-emerald-600/30 hover:border-emerald-500/50',
    icon: 'bg-emerald-600/20',
    iconColor: 'text-emerald-400',
    trend: 'text-emerald-400'
  },
  warning: {
    container: 'from-amber-600/20 to-amber-600/5 border-amber-600/30 hover:border-amber-500/50',
    icon: 'bg-amber-600/20',
    iconColor: 'text-amber-400',
    trend: 'text-amber-400'
  },
  danger: {
    container: 'from-red-600/20 to-red-600/5 border-red-600/30 hover:border-red-500/50',
    icon: 'bg-red-600/20',
    iconColor: 'text-red-400',
    trend: 'text-red-400'
  },
  info: {
    container: 'from-blue-600/20 to-blue-600/5 border-blue-600/30 hover:border-blue-500/50',
    icon: 'bg-blue-600/20',
    iconColor: 'text-blue-400',
    trend: 'text-blue-400'
  }
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  variant = 'default',
  onClick 
}: MetricCardProps) {
  const styles = variantStyles[variant]
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      onClick={onClick}
      className={`group relative overflow-hidden bg-gradient-to-br ${styles.container} border rounded-2xl p-6 transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} w-full text-left`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 ${styles.icon} rounded-xl backdrop-blur-sm`}>
            <Icon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
          {trend && (
            <span className={`text-xs font-medium ${trend.isPositive ? styles.trend : 'text-red-400'}`}>
              {trend.isPositive ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400 mt-1">{title}</div>
        {subtitle && (
          <div className="text-xs text-gray-500 mt-2">{subtitle}</div>
        )}
      </div>
    </Component>
  )
}