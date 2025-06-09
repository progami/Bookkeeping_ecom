import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Test cookie setting and retrieval
  const testValue = 'test_' + Math.random().toString(36).substring(7);
  
  const response = NextResponse.json({
    message: 'Cookie test',
    setValue: testValue,
    existingCookies: request.cookies.getAll()
  });
  
  response.cookies.set('test_cookie', testValue, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/'
  });
  
  return response;
}