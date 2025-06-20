import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { AppLayout } from '@/components/layouts/app-layout'
import { ClientLoggerInit } from '@/components/client-logger-init'
import { ErrorBoundary } from '@/components/error-boundary'
import { DevLogPanel } from '@/components/dev-log-panel'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bookkeeping',
  description: 'Automated bookkeeping and financial categorization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Initialize logger IMMEDIATELY to capture ALL browser logs */}
        {process.env.NODE_ENV === 'development' && (
          <script async src="/init-logger.js" />
        )}
      </head>
      <body className={inter.className}>
        <ClientLoggerInit />
        <ErrorBoundary>
          <Providers>
            <AppLayout>
              {children}
            </AppLayout>
          </Providers>
        </ErrorBoundary>
        {process.env.NODE_ENV === 'development' && <DevLogPanel />}
      </body>
    </html>
  )
}