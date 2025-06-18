import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from './xero-client';
import { Logger } from '@/lib/logger';

const logger = new Logger({ module: 'api-helpers' });

export async function withXeroAuth<T = any>(
  handler: (
    request: NextRequest, 
    context: { client: any; tenantId: string }
  ) => Promise<NextResponse<T>>
): Promise<(request: NextRequest) => Promise<NextResponse>> {
  return async (request: NextRequest) => {
    try {
      // Force dynamic rendering to ensure cookies are available
      const xeroData = await getXeroClientWithTenant();
      
      if (!xeroData) {
        logger.info('No Xero client available in withXeroAuth');
        return NextResponse.json(
          { error: 'Not connected to Xero' }, 
          { status: 401 }
        );
      }
      
      return await handler(request, xeroData);
    } catch (error: any) {
      logger.error('Error in withXeroAuth:', error);
      return NextResponse.json(
        { error: 'Authentication error', message: error.message }, 
        { status: 500 }
      );
    }
  };
}

// Helper to ensure dynamic rendering in API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';