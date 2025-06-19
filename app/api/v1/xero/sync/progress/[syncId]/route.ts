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
    
    // As a backup, also add no-cache headers to the response
    return NextResponse.json(progress, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fetch progress',
      message: error.message 
    }, { status: 500 });
  }
}