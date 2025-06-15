'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface ModuleHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

export function ModuleHeader({ 
  title, 
  subtitle, 
  backTo = '/', 
  backLabel = 'Back to Home',
  actions 
}: ModuleHeaderProps) {
  const router = useRouter()
  
  return (
    <div className="mb-8">
      <button
        onClick={() => router.push(backTo)}
        className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
      >
        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        {backLabel}
      </button>
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-400">{subtitle}</p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}