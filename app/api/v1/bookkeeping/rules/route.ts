import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = includeInactive ? {} : { isActive: true }

    const rules = await prisma.categorizationRule.findMany({
      where,
      orderBy: { priority: 'desc' }
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching categorization rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categorization rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['name', 'matchType', 'matchField', 'matchValue', 'accountCode', 'taxType']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Validate matchType
    const validMatchTypes = ['contains', 'equals', 'startsWith', 'endsWith']
    if (!validMatchTypes.includes(body.matchType)) {
      return NextResponse.json(
        { error: 'Invalid matchType' },
        { status: 400 }
      )
    }

    // Validate matchField
    const validMatchFields = ['description', 'payee', 'reference']
    if (!validMatchFields.includes(body.matchField)) {
      return NextResponse.json(
        { error: 'Invalid matchField' },
        { status: 400 }
      )
    }

    const rule = await prisma.categorizationRule.create({
      data: {
        name: body.name,
        description: body.description,
        matchType: body.matchType,
        matchField: body.matchField,
        matchValue: body.matchValue,
        accountCode: body.accountCode,
        taxType: body.taxType,
        priority: body.priority || 0
      }
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Error creating categorization rule:', error)
    return NextResponse.json(
      { error: 'Failed to create categorization rule' },
      { status: 500 }
    )
  }
}