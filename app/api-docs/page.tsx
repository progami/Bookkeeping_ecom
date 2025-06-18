'use client'

import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { openAPISpec } from '@/lib/openapi-spec'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <UnifiedPageHeader
        title="API Documentation"
        description="Explore the available endpoints for the Bookkeeping API."
      />
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
        <div className="swagger-container">
          <SwaggerUI spec={openAPISpec} />
        </div>
      </div>
      <style jsx global>{`
        .swagger-container .swagger-ui {
          filter: invert(1) hue-rotate(180deg);
        }
        .swagger-container .topbar {
          display: none;
        }
      `}</style>
    </div>
  )
}