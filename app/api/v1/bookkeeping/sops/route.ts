import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET all SOPs with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year')
    const chartOfAccount = searchParams.get('chartOfAccount')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (year) where.year = year
    if (chartOfAccount) where.chartOfAccount = chartOfAccount
    if (isActive !== null) where.isActive = isActive === 'true'

    const sops = await prisma.standardOperatingProcedure.findMany({
      where,
      orderBy: [
        { chartOfAccount: 'asc' },
        { serviceType: 'asc' }
      ]
    })

    return NextResponse.json(sops)
  } catch (error) {
    console.error('Error fetching SOPs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SOPs' },
      { status: 500 }
    )
  }
}

// POST - Create new SOP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const required = ['year', 'chartOfAccount', 'serviceType', 'referenceTemplate', 
                     'referenceExample', 'descriptionTemplate', 'descriptionExample']
    
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Check if SOP already exists
    const existing = await prisma.standardOperatingProcedure.findUnique({
      where: {
        year_chartOfAccount_serviceType: {
          year: body.year,
          chartOfAccount: body.chartOfAccount,
          serviceType: body.serviceType
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'SOP already exists for this combination' },
        { status: 409 }
      )
    }

    const sop = await prisma.standardOperatingProcedure.create({
      data: body
    })

    return NextResponse.json(sop, { status: 201 })
  } catch (error) {
    console.error('Error creating SOP:', error)
    return NextResponse.json(
      { error: 'Failed to create SOP' },
      { status: 500 }
    )
  }
}

// PUT - Update multiple SOPs (bulk update)
export async function PUT(request: NextRequest) {
  try {
    const { sops } = await request.json()
    
    if (!Array.isArray(sops)) {
      return NextResponse.json(
        { error: 'Expected array of SOPs' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      sops.map(async (sop) => {
        if (!sop.id) {
          // Create new
          return prisma.standardOperatingProcedure.create({
            data: sop
          })
        } else {
          // Update existing
          return prisma.standardOperatingProcedure.update({
            where: { id: sop.id },
            data: sop
          })
        }
      })
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error updating SOPs:', error)
    return NextResponse.json(
      { error: 'Failed to update SOPs' },
      { status: 500 }
    )
  }
}