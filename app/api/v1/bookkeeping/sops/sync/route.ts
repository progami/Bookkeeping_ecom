import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sopData } from '@/lib/sop-data';

export async function POST(request: NextRequest) {
  try {
    // Sync SOP data from lib/sop-data.ts to database
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const [year, yearData] of Object.entries(sopData)) {
      for (const [chartOfAccount, sops] of Object.entries(yearData)) {
        if (!Array.isArray(sops)) continue;
        
        for (const sop of sops) {
          try {
            await prisma.standardOperatingProcedure.upsert({
              where: {
                year_chartOfAccount_serviceType: {
                  year,
                  chartOfAccount,
                  serviceType: sop.serviceType
                }
              },
              update: {
                pointOfInvoice: 'pointOfInvoice' in sop && typeof sop.pointOfInvoice === 'string' ? sop.pointOfInvoice : null,
                referenceTemplate: sop.referenceTemplate,
                referenceExample: sop.referenceExample,
                descriptionTemplate: sop.descriptionTemplate,
                descriptionExample: sop.descriptionExample,
                note: sop.note || null,
                updatedAt: new Date()
              },
              create: {
                year,
                chartOfAccount,
                pointOfInvoice: 'pointOfInvoice' in sop && typeof sop.pointOfInvoice === 'string' ? sop.pointOfInvoice : null,
                serviceType: sop.serviceType,
                referenceTemplate: sop.referenceTemplate,
                referenceExample: sop.referenceExample,
                descriptionTemplate: sop.descriptionTemplate,
                descriptionExample: sop.descriptionExample,
                note: sop.note || null
              }
            });
            
            const existing = await prisma.standardOperatingProcedure.findUnique({
              where: {
                year_chartOfAccount_serviceType: {
                  year,
                  chartOfAccount,
                  serviceType: sop.serviceType
                }
              }
            });
            
            if (existing) {
              updated++;
            } else {
              created++;
            }
          } catch (error) {
            console.error(`Error syncing SOP for ${year}/${chartOfAccount}/${sop.serviceType}:`, error);
            errors++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'SOP data synced successfully',
      stats: {
        created,
        updated,
        errors,
        total: created + updated
      }
    });
  } catch (error) {
    console.error('Error syncing SOP data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync SOP data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all SOPs from database
    const sops = await prisma.standardOperatingProcedure.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { year: 'desc' },
        { chartOfAccount: 'asc' },
        { serviceType: 'asc' }
      ]
    });

    // Group by year and chart of account
    const groupedData: Record<string, Record<string, any[]>> = {};
    
    for (const sop of sops) {
      if (!groupedData[sop.year]) {
        groupedData[sop.year] = {};
      }
      
      if (!groupedData[sop.year][sop.chartOfAccount]) {
        groupedData[sop.year][sop.chartOfAccount] = [];
      }
      
      groupedData[sop.year][sop.chartOfAccount].push({
        pointOfInvoice: sop.pointOfInvoice,
        serviceType: sop.serviceType,
        referenceTemplate: sop.referenceTemplate,
        referenceExample: sop.referenceExample,
        descriptionTemplate: sop.descriptionTemplate,
        descriptionExample: sop.descriptionExample,
        note: sop.note
      });
    }

    return NextResponse.json({
      success: true,
      data: groupedData,
      count: sops.length
    });
  } catch (error) {
    console.error('Error fetching SOP data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch SOP data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}