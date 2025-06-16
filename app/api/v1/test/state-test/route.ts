import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// In-memory state for testing (in production, use Redis)
let globalState = {
  counter: 0,
  lastUpdated: new Date().toISOString(),
  activeUsers: 0
};

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ...globalState,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  if (body.action === 'increment') {
    globalState.counter++;
  } else if (body.action === 'decrement') {
    globalState.counter--;
  } else if (body.action === 'reset') {
    globalState.counter = 0;
  } else if (body.action === 'setActiveUsers') {
    globalState.activeUsers = body.value || 0;
  }
  
  globalState.lastUpdated = new Date().toISOString();
  
  return NextResponse.json({
    success: true,
    newState: globalState
  });
}