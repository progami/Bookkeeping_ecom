import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sopData } from '@/lib/sop-data'

// POST - Import initial SOPs from static data
export async function POST(request: NextRequest) {
  try {
    const allSops: any[] = []
    
    // Convert static SOP data to database format
    Object.entries(sopData).forEach(([year, yearData]) => {
      Object.entries(yearData).forEach(([chartOfAccount, sops]) => {
        sops.forEach((sop: any) => {
          allSops.push({
            year,
            chartOfAccount,
            pointOfInvoice: sop.pointOfInvoice || null,
            serviceType: sop.serviceType,
            referenceTemplate: sop.referenceTemplate,
            referenceExample: sop.referenceExample,
            descriptionTemplate: sop.descriptionTemplate,
            descriptionExample: sop.descriptionExample,
            note: sop.note || null,
            isActive: true
          })
        })
      })
    })

    // Clear existing SOPs
    await prisma.standardOperatingProcedure.deleteMany()
    
    // Insert all SOPs
    const result = await prisma.standardOperatingProcedure.createMany({
      data: allSops
    })

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: allSops.length
    })
  } catch (error) {
    console.error('Error importing SOPs:', error)
    return NextResponse.json(
      { error: 'Failed to import SOPs' },
      { status: 500 }
    )
  }
}