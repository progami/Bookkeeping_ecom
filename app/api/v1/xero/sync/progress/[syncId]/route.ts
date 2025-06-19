import { NextRequest, NextResponse } from 'next/server';
import { getSyncProgress } from '@/lib/sync-progress-manager';

// Add this line to disable caching for this route
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { syncId: string } }
) {
  try {
    const syncId = params.syncId;
    const progress = await getSyncProgress(syncId);
    
    if (!progress) {
      return NextResponse.json({ 
        error: 'Sync not found' 
      }, { status: 404 });
    }
    
    // Explicitly add no-cache headers to every response from this endpoint.
    return NextResponse.json(progress, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fetch progress',
      message: error.message 
    }, { status: 500 });
  }
}