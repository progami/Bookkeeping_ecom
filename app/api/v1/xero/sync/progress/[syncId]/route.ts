import { NextRequest, NextResponse } from 'next/server';
import { getSyncProgress } from '@/lib/sync-progress-manager';

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
    
    return NextResponse.json(progress);
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fetch progress',
      message: error.message 
    }, { status: 500 });
  }
}