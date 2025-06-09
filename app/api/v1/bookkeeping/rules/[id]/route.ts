import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const rule = await prisma.categorizationRule.findUnique({
      where: { id }
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching categorization rule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categorization rule' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { id } = params

    const rule = await prisma.categorizationRule.update({
      where: { id },
      data: body
    })

    return NextResponse.json(rule)
  } catch (error: any) {
    console.error('Error updating categorization rule:', error)
    
    if (error.code === 'P2025' || error.message?.includes('Record not found')) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update categorization rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    await prisma.categorizationRule.delete({
      where: { id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Error deleting categorization rule:', error)
    
    if (error.code === 'P2025' || error.message?.includes('Record not found')) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete categorization rule' },
      { status: 500 }
    )
  }
}