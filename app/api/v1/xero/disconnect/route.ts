import { NextRequest, NextResponse } from 'next/server';
import { clearTokenSet } from '@/lib/xero-client';

export async function POST(request: NextRequest) {
  try {
    await clearTokenSet();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Xero:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}