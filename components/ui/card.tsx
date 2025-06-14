import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  )
}