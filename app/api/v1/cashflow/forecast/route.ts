import { NextRequest, NextResponse } from 'next/server';
import { CashFlowEngine } from '@/lib/cashflow-engine';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '90');
    const includeScenarios = searchParams.get('scenarios') === 'true';

    // Generate forecast
    const engine = new CashFlowEngine();
    const forecast = await engine.generateForecast(days);

    // Format response
    const response = {
      forecast: forecast.map(day => ({
        date: day.date.toISOString(),
        openingBalance: day.openingBalance,
        inflows: day.inflows,
        outflows: day.outflows,
        closingBalance: day.closingBalance,
        confidenceLevel: day.confidenceLevel,
        alerts: day.alerts,
        ...(includeScenarios && { scenarios: day.scenarios }),
      })),
      summary: {
        days,
        lowestBalance: Math.min(...forecast.map(f => f.closingBalance)),
        lowestBalanceDate: forecast.find(
          f => f.closingBalance === Math.min(...forecast.map(d => d.closingBalance))
        )?.date,
        totalInflows: forecast.reduce((sum, f) => sum + f.inflows.total, 0),
        totalOutflows: forecast.reduce((sum, f) => sum + f.outflows.total, 0),
        averageConfidence: 
          forecast.reduce((sum, f) => sum + f.confidenceLevel, 0) / forecast.length,
        criticalAlerts: forecast.flatMap(f => 
          f.alerts.filter(a => a.severity === 'critical')
        ).length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Forecast generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Forecast failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { days = 90, regenerate = false } = await request.json();

    if (regenerate) {
      // Clear existing forecast
      await prisma.cashFlowForecast.deleteMany({
        where: {
          date: { gte: new Date() },
        },
      });
    }

    // Generate new forecast
    const engine = new CashFlowEngine();
    const forecast = await engine.generateForecast(days);

    return NextResponse.json({
      success: true,
      daysGenerated: forecast.length,
      message: `Forecast generated for ${days} days`,
    });
  } catch (error) {
    console.error('Forecast generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Forecast failed' },
      { status: 500 }
    );
  }
}