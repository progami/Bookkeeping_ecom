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
    border: 'border-slate-700/50 hover:border-slate-500/50',
    icon: 'bg-slate-600/20',
    iconColor: 'text-slate-400',
    tag: 'bg-slate-600/20 text-slate-400'
  },
  success: {
    border: 'border-emerald-700/50 hover:border-emerald-500/50',
    icon: 'bg-emerald-600/20',
    iconColor: 'text-emerald-400',
    tag: 'bg-emerald-600/20 text-emerald-400'
  },
  warning: {
    border: 'border-amber-700/50 hover:border-amber-500/50',
    icon: 'bg-amber-600/20',
    iconColor: 'text-amber-400',
    tag: 'bg-amber-600/20 text-amber-400'
  },
  danger: {
    border: 'border-red-700/50 hover:border-red-500/50',
    icon: 'bg-red-600/20',
    iconColor: 'text-red-400',
    tag: 'bg-red-600/20 text-red-400'
  },
  info: {
    border: 'border-blue-700/50 hover:border-blue-500/50',
    icon: 'bg-blue-600/20',
    iconColor: 'text-blue-400',
    tag: 'bg-blue-600/20 text-blue-400'
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
      className={`group relative bg-slate-800/50 backdrop-blur-sm border ${styles.border} rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-1`}
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
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
          <ArrowUpRight className={`h-5 w-5 text-gray-400 group-hover:${styles.iconColor} transition-colors`} />
        </div>
        
        {stats && (
          <div className={`grid grid-cols-${stats.length} gap-3 mb-4`}>
            {stats.map((stat, index) => (
              <div key={index} className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-sm font-medium text-white">{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label}</div>
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