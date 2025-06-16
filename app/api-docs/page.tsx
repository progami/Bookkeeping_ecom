'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">API Documentation</h1>
        <div className="swagger-ui-wrapper">
          <SwaggerUI url="/api/v1/openapi.json" />
        </div>
      </div>
      <style jsx global>{`
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 50px 0;
        }
        .swagger-ui .scheme-container {
          background: #f4f4f4;
          padding: 20px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}