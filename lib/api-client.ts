import { ErrorCode } from './api-error-handler';

interface ApiClientOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  onError?: (error: any) => void;
}

interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
    retryAfter?: number;
  };
  meta?: any;
}

class ApiClient {
  private baseUrl: string = '';
  private defaultOptions: ApiClientOptions = {
    retries: 3,
    retryDelay: 1000,
    timeout: 30000
  };

  async request<T = any>(
    url: string,
    options: RequestInit & ApiClientOptions = {}
  ): Promise<ApiResponse<T>> {
    const { 
      retries = this.defaultOptions.retries,
      retryDelay = this.defaultOptions.retryDelay,
      timeout = this.defaultOptions.timeout,
      onError,
      ...fetchOptions 
    } = options;

    let lastError: any;
    
    for (let attempt = 0; attempt <= retries!; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout!);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers
          }
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          // Handle specific error codes
          if (response.status === 429) {
            // Rate limited - use retry-after header
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
            
            if (attempt < retries!) {
              await this.delay(retryAfter * 1000);
              continue;
            }
          }

          if (response.status === 503 || response.status === 409) {
            // Service unavailable or conflict - retry with exponential backoff
            if (attempt < retries!) {
              await this.delay(retryDelay! * Math.pow(2, attempt));
              continue;
            }
          }

          // Don't retry client errors (4xx except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return data;
          }

          lastError = data.error || { code: 'UNKNOWN', message: 'Request failed' };
          throw new Error(lastError.message);
        }

        return data;
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = {
            code: ErrorCode.DATABASE_TIMEOUT,
            message: 'Request timed out'
          };
        }

        if (attempt === retries) {
          if (onError) {
            onError(lastError);
          }
          
          return {
            error: {
              code: lastError.code || ErrorCode.INTERNAL_ERROR,
              message: lastError.message || 'An unexpected error occurred',
              details: lastError.details
            }
          };
        }

        // Wait before retry
        await this.delay(retryDelay! * Math.pow(2, attempt));
      }
    }

    return {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Maximum retries exceeded',
        details: lastError
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T = any>(url: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T = any>(url: string, data?: any, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = any>(url: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export for use in React components
export function useApi() {
  return apiClient;
}