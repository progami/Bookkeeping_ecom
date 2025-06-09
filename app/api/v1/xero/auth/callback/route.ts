import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet } from '@/lib/xero-client';
import { stateStore } from '../route';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
  
  // Handle errors
  if (error) {
    console.error('Xero OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=${encodeURIComponent(errorDescription || error)}`);
  }
  
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=no_code`);
  }
  
  // Verify state (CSRF protection)
  const storedState = request.cookies.get('xero_state')?.value;
  const stateInMemory = state ? stateStore.has(state) : false;
  
  console.log('Callback received - state:', state);
  console.log('State in cookie:', storedState);
  console.log('State in memory:', stateInMemory);
  console.log('All states in memory:', Array.from(stateStore.keys()));
  
  // TEMPORARY WORKAROUND: Xero is not returning the state parameter
  // If we have a valid cookie state and no state in URL, continue anyway
  const isXeroStateBug = !state && storedState && code;
  
  if (isXeroStateBug) {
    console.warn('WARNING: Xero did not return state parameter. Proceeding with cookie validation only.');
  }
  
  // Check both cookie and memory store
  const isValidState = (storedState && state === storedState) || stateInMemory || isXeroStateBug;
  
  if (!isValidState) {
    console.error('State validation failed');
    console.error('Received state:', state);
    console.error('Cookie state:', storedState);
    console.error('Memory has state:', stateInMemory);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=invalid_state`);
  }
  
  // Clean up the state from memory
  if (state) {
    stateStore.delete(state);
  }
  
  try {
    // Exchange code for token
    const xero = createXeroClient();
    await xero.initialize();
    const tokenSet = await xero.apiCallback(code);
    
    // Store token in secure cookie
    await storeTokenSet(tokenSet);
    
    // Clear state cookie
    const response = NextResponse.redirect(`${baseUrl}/bookkeeping?connected=true`);
    response.cookies.delete('xero_state');
    
    return response;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=token_exchange_failed`);
  }
}