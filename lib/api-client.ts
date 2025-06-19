/**
 * API client utility for making requests from the frontend
 */

// Get the base URL for API requests
export function getApiBaseUrl(): string {
  // In development, we need to use the full URL with the correct port
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'https://localhost:3003';
  }
  // In production or other environments, use relative URLs
  return '';
}

// Helper function to make authenticated API requests
export async function apiRequest(path: string, options: RequestInit = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

// Export as apiClient for backward compatibility
export const apiClient = {
  get: (path: string, options?: RequestInit) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestInit) => 
    apiRequest(path, { 
      ...options, 
      method: 'POST',
      body: JSON.stringify(body)
    }),
  put: (path: string, body?: any, options?: RequestInit) => 
    apiRequest(path, { 
      ...options, 
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  delete: (path: string, options?: RequestInit) => apiRequest(path, { ...options, method: 'DELETE' }),
};