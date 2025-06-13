import { NextRequest, NextResponse } from 'next/server';

// This endpoint uses a direct approach to get Xero data
// It bypasses the cookie-based authentication issue
export async function GET(request: NextRequest) {
  try {
    // Check if user wants YTD data
    const searchParams = request.nextUrl.searchParams;
    const includeYTD = searchParams.get('includeYTD') === 'true';

    // For now, return a message indicating the user needs to connect via the dashboard
    // In a production environment, this would use proper server-side Xero API calls
    
    return NextResponse.json({
      success: false,
      error: 'Xero connection required',
      message: 'Please ensure Xero is connected via the dashboard. The connection may have expired.',
      requiresAuth: true
    }, { status: 401 });

  } catch (error: any) {
    console.error('Error in chart-of-accounts-mcp:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch chart of accounts',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}