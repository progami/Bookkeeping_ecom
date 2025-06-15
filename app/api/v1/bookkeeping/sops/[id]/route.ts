import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET single SOP
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sop = await prisma.standardOperatingProcedure.findUnique({
      where: { id: params.id }
    })

    if (!sop) {
      return NextResponse.json(
        { error: 'SOP not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(sop)
  } catch (error) {
    console.error('Error fetching SOP:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SOP' },
      { status: 500 }
    )
  }
}

// PUT - Update single SOP
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const sop = await prisma.standardOperatingProcedure.update({
      where: { id: params.id },
      data: body
    })

    return NextResponse.json(sop)
  } catch (error) {
    console.error('Error updating SOP:', error)
    return NextResponse.json(
      { error: 'Failed to update SOP' },
      { status: 500 }
    )
  }
}

// DELETE single SOP
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.standardOperatingProcedure.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting SOP:', error)
    return NextResponse.json(
      { error: 'Failed to delete SOP' },
      { status: 500 }
    )
  }
}