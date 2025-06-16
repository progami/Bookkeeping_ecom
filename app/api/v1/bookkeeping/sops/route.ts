import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withValidation } from '@/lib/validation/middleware'
import { z } from 'zod'

// Validation schemas
const sopQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).optional(),
  chartOfAccount: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  pageSize: z.string().regex(/^\d+$/).optional()
});

const createSOPSchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Year must be YYYY format'),
  chartOfAccount: z.string().min(1).max(100),
  serviceType: z.string().min(1).max(100),
  referenceTemplate: z.string().min(1),
  referenceExample: z.string().min(1),
  descriptionTemplate: z.string().min(1),
  descriptionExample: z.string().min(1),
  notes: z.string().optional()
});

// GET all SOPs with optional filtering and pagination
export const GET = withValidation(
  { querySchema: sopQuerySchema },
  async (request, { query }) => {
    const where: any = {}
    if (query?.year) where.year = query.year
    if (query?.chartOfAccount) where.chartOfAccount = query.chartOfAccount
    if (query?.isActive !== undefined) where.isActive = query.isActive === 'true'
    
    const page = parseInt(query?.page || '1')
    const pageSize = parseInt(query?.pageSize || '50')
    const skip = (page - 1) * pageSize

    const [sops, total] = await Promise.all([
      prisma.standardOperatingProcedure.findMany({
        where,
        orderBy: [
          { chartOfAccount: 'asc' },
          { serviceType: 'asc' }
        ],
        skip,
        take: pageSize
      }),
      prisma.standardOperatingProcedure.count({ where })
    ])
    
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      sops,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    })
  }
)

// POST - Create new SOP
export const POST = withValidation(
  { bodySchema: createSOPSchema },
  async (request, { body }) => {

    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
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
  }
)

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