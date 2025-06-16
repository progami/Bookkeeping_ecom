import React from 'react'
import { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'

interface ModuleCardProps {
  title: string
  subtitle: string
  icon: LucideIcon
  onClick: () => void
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  stats?: Array<{
    label: string
    value: string | number
  }>
  tags?: string[]
}

const variantStyles = {
  default: {
    border: 'border-default hover:border-light',
    icon: 'bg-tertiary',
    iconColor: 'text-tertiary',
    tag: 'bg-tertiary text-tertiary'
  },
  success: {
    border: 'border-brand-emerald hover:border-brand-emerald-light',
    icon: 'bg-brand-emerald',
    iconColor: 'text-brand-emerald',
    tag: 'bg-brand-emerald text-brand-emerald'
  },
  warning: {
    border: 'border-brand-amber hover:border-brand-amber-light',
    icon: 'bg-brand-amber',
    iconColor: 'text-brand-amber',
    tag: 'bg-brand-amber text-brand-amber'
  },
  danger: {
    border: 'border-brand-red hover:border-brand-red-light',
    icon: 'bg-brand-red',
    iconColor: 'text-brand-red',
    tag: 'bg-brand-red text-brand-red'
  },
  info: {
    border: 'border-brand-blue hover:border-brand-blue-light',
    icon: 'bg-brand-blue',
    iconColor: 'text-brand-blue',
    tag: 'bg-brand-blue text-brand-blue'
  }
}

export function ModuleCard({ 
  title, 
  subtitle, 
  icon: Icon, 
  onClick,
  variant = 'default',
  stats,
  tags
}: ModuleCardProps) {
  const styles = variantStyles[variant]
  
  return (
    <div 
      className={`group relative bg-secondary backdrop-blur-sm border ${styles.border} rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-1`}
      onClick={onClick}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 ${styles.icon} rounded-xl`}>
              <Icon className={`h-6 w-6 ${styles.iconColor}`} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
              <p className="text-sm text-tertiary line-clamp-2">{subtitle}</p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-primary transition-colors" />
        </div>
        
        {stats && (
          <div className={`grid ${
            stats.length === 1 ? 'grid-cols-1' :
            stats.length === 2 ? 'grid-cols-2' :
            stats.length === 3 ? 'grid-cols-3' :
            stats.length === 4 ? 'grid-cols-4' :
            'grid-cols-2'
          } gap-3 mb-4`}>
            {stats.map((stat, index) => (
              <div key={index} className="bg-primary rounded-lg p-3">
                <div className="text-sm font-medium text-primary">{stat.value}</div>
                <div className="text-xs text-tertiary">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
        
        {tags && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span key={index} className={`px-2 py-1 ${styles.tag} rounded text-xs`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}