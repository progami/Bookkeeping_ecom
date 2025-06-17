'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCode?: string;
  retryCount: number;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Determine error type
    let errorCode = 'UNKNOWN';
    if (error.message.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
    } else if (error.message.includes('timeout')) {
      errorCode = 'TIMEOUT';
    }

    return {
      hasError: true,
      error,
      errorCode
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: this.state.retryCount + 1
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                {this.state.errorCode === 'NETWORK_ERROR' && 
                  'Unable to connect to the server. Please check your connection.'}
                {this.state.errorCode === 'TIMEOUT' && 
                  'The operation took too long. Please try again.'}
                {this.state.errorCode === 'UNKNOWN' && 
                  'An unexpected error occurred. Please try refreshing the page.'}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={this.handleReset}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex-1"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>

            {this.state.retryCount > 2 && (
              <Alert>
                <AlertDescription>
                  If this problem persists, please contact support.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: (error: Error) => setError(error),
    resetError: () => setError(null)
  };
}