import { NextRequest, NextResponse } from 'next/server';
import { openAPISpec } from '@/lib/openapi-spec';

export async function GET(request: NextRequest) {
  return NextResponse.json(openAPISpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}