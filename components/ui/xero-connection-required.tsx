'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react'
import { ReactNode } from 'react'

interface XeroConnectionRequiredProps {
  title: string
  description: string
  features: {
    icon: ReactNode
    title: string
    description: string
  }[]
}

export function XeroConnectionRequired({ 
  title, 
  description, 
  features 
}: XeroConnectionRequiredProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-emerald/10 rounded-full mb-6">
            <Building2 className="h-10 w-10 text-brand-emerald" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">{description}</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-white">What you'll unlock:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="space-y-3">
                  <div className="w-12 h-12 bg-brand-emerald/10 rounded-lg flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center space-y-4">
          <Button
            size="lg"
            onClick={() => router.push('/connect')}
            className="min-w-[200px]"
          >
            Connect to Xero
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Bank-level security</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Read-only access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}