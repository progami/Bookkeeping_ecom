import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from './xero-client';
import { structuredLogger } from './logger';

export interface AuthenticatedRequest extends NextRequest {
  xeroUser?: {
    tenantId: string;
    tenantName: string;
    email?: string;
  };
}

// Middleware to verify Xero authentication
export async function requireXeroAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get Xero client to verify authentication
    const xeroClient = await getXeroClient();
    
    if (!xeroClient) {
      structuredLogger.warn('Unauthorized access attempt - no Xero client', {
        component: 'auth-middleware',
        path: request.nextUrl.pathname
      });
      
      return NextResponse.json(
        { error: 'Not authenticated with Xero' },
        { status: 401 }
      );
    }
    
    // Update tenants to get current info
    await xeroClient.updateTenants();
    
    if (!xeroClient.tenants || xeroClient.tenants.length === 0) {
      structuredLogger.warn('Unauthorized access attempt - no tenants', {
        component: 'auth-middleware',
        path: request.nextUrl.pathname
      });
      
      return NextResponse.json(
        { error: 'No Xero organizations connected' },
        { status: 401 }
      );
    }
    
    // Get the primary tenant
    const tenant = xeroClient.tenants[0];
    
    // Enhance request with user info
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.xeroUser = {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName || 'Unknown',
      // Note: Xero doesn't provide user email in tenant info
      // Would need to make additional API call to get user details
    };
    
    structuredLogger.debug('Request authenticated', {
      component: 'auth-middleware',
      tenantId: tenant.tenantId,
      path: request.nextUrl.pathname
    });
    
    // Call the handler with authenticated request
    return await handler(authenticatedRequest);
  } catch (error) {
    structuredLogger.error('Auth middleware error', error, {
      component: 'auth-middleware',
      path: request.nextUrl.pathname
    });
    
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// Middleware for API routes that require specific Xero scopes
export async function requireXeroScopes(
  request: NextRequest,
  requiredScopes: string[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return requireXeroAuth(request, async (req) => {
    // Check if token has required scopes
    const tokenSet = await getStoredTokenSet();
    
    if (!tokenSet?.scope) {
      return NextResponse.json(
        { error: 'No scopes available' },
        { status: 403 }
      );
    }
    
    const tokenScopes = tokenSet.scope.split(' ');
    const hasAllScopes = requiredScopes.every(scope => 
      tokenScopes.includes(scope)
    );
    
    if (!hasAllScopes) {
      structuredLogger.warn('Insufficient scopes', {
        component: 'auth-middleware',
        required: requiredScopes,
        available: tokenScopes,
        path: request.nextUrl.pathname
      });
      
      return NextResponse.json(
        { 
          error: 'Insufficient permissions',
          requiredScopes,
          availableScopes: tokenScopes
        },
        { status: 403 }
      );
    }
    
    return handler(req);
  });
}

// Helper to get stored token set
async function getStoredTokenSet() {
  const { XeroSession } = await import('./xero-session');
  return await XeroSession.getToken();
}