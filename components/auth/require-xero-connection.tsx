'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface RequireXeroConnectionProps {
  children: React.ReactNode;
}

export function RequireXeroConnection({ children }: RequireXeroConnectionProps) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkXeroConnection();
  }, []);

  const checkXeroConnection = async () => {
    try {
      const response = await fetch('/api/v1/xero/status');
      if (!response.ok) {
        setIsConnected(false);
        return;
      }
      
      const data = await response.json();
      setIsConnected(data.connected || false);
    } catch (error) {
      console.error('Error checking Xero connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Xero Connection Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This page requires an active Xero connection. Please connect your Xero account to continue.
            </p>
            <Button 
              onClick={() => {
                const currentPath = window.location.pathname
                window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(currentPath)}`
              }}
              className="w-full"
            >
              Connect to Xero
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}