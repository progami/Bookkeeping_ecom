import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
          {description && (
            <p className="text-gray-400">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}