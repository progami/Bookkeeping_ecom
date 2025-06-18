import { NextRequest, NextResponse } from 'next/server';
import { CashFlowEngine } from '@/lib/cashflow-engine';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { cashFlowForecastQuerySchema, cashFlowForecastBodySchema } from '@/lib/validation/schemas';
import { getApiLogger, logApiCall } from '@/lib/api-logger';
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation';

export const GET = withValidation(
  { querySchema: cashFlowForecastQuerySchema },
  async (request, { query }) => {
    const logger = getApiLogger(request);
    
    try {
      const days = query?.days || 90;
      const includeScenarios = query?.scenarios || false;
      
      logger.info('Generating cashflow forecast', { days, includeScenarios });
      
      // Validate session
      const session = await validateSession(request, ValidationLevel.USER);
      
      if (!session.isValid || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const tenantId = session.user.tenantId;
      
      if (!tenantId) {
        return NextResponse.json({ error: 'No tenant ID in session' }, { status: 401 });
      }
    
    // Set cache headers based on forecast days
    const cacheTime = days <= 30 ? 300 : 600; // 5 min for short, 10 min for long forecasts
    const responseHeaders = {
      'Cache-Control': `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`,
      'CDN-Cache-Control': `max-age=${cacheTime * 2}`,
    };

    // Generate forecast - pass tenantId
    const engine = new CashFlowEngine();
    const forecast = await logApiCall(
      logger,
      `generate forecast for ${days} days`,
      () => engine.generateForecast(days, tenantId)
    );

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

      logger.info('Cashflow forecast generated successfully', {
        days,
        forecastDays: forecast.length,
        lowestBalance: response.summary.lowestBalance,
        criticalAlerts: response.summary.criticalAlerts,
      });
      
      return NextResponse.json(response, {
        headers: responseHeaders
      });
    } catch (error) {
      logger.error('Forecast generation error', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Forecast failed' },
        { status: 500 }
      );
    }
  }
)

export const POST = withValidation(
  { bodySchema: cashFlowForecastBodySchema },
  async (request, { body }) => {
    const logger = getApiLogger(request);
    
    try {
      const days = body?.days || 90;
      const regenerate = body?.regenerate || false;
      
      logger.info('Processing cashflow forecast request', { days, regenerate });
      
      // Get session from cookie
      const userSessionCookie = request.cookies.get('user_session');
      if (!userSessionCookie) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const session = JSON.parse(userSessionCookie.value);
      const tenantId = session.tenantId;
      
      if (!tenantId) {
        return NextResponse.json({ error: 'No tenant ID in session' }, { status: 401 });
      }

    if (regenerate) {
      // Clear existing forecast
      const deleted = await logApiCall(
        logger,
        'clear existing forecast',
        () => prisma.cashFlowForecast.deleteMany({
          where: {
            date: { gte: new Date() },
          },
        })
      );
      logger.info('Cleared existing forecast', { deletedCount: deleted.count });
    }

    // Generate new forecast - pass tenantId
    const engine = new CashFlowEngine();
    const forecast = await logApiCall(
      logger,
      `regenerate forecast for ${days} days`,
      () => engine.generateForecast(days, tenantId)
    );

      logger.info('Cashflow forecast regenerated successfully', {
        days,
        daysGenerated: forecast.length,
      });
      
      return NextResponse.json({
        success: true,
        daysGenerated: forecast.length,
        message: `Forecast generated for ${days} days`,
      });
    } catch (error) {
      logger.error('Forecast generation error', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Forecast failed' },
        { status: 500 }
      );
    }
  }
)