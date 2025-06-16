import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableName = searchParams.get('table')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const limit = pageSize
    const offset = (page - 1) * pageSize

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    let data: any[] = []
    let total = 0

    // Fetch data based on table name
    switch (tableName) {
      case 'BankAccount':
        [data, total] = await Promise.all([
          prisma.bankAccount.findMany({ skip: offset, take: limit, orderBy: { name: 'asc' } }),
          prisma.bankAccount.count()
        ])
        break
      
      case 'BankTransaction':
        [data, total] = await Promise.all([
          prisma.bankTransaction.findMany({ 
            skip: offset, 
            take: limit, 
            orderBy: { date: 'desc' },
            include: { bankAccount: { select: { name: true } } }
          }),
          prisma.bankTransaction.count()
        ])
        break
      
      case 'GLAccount':
        [data, total] = await Promise.all([
          prisma.gLAccount.findMany({ skip: offset, take: limit, orderBy: { code: 'asc' } }),
          prisma.gLAccount.count()
        ])
        break
      
      case 'Contact':
        // Contact model not in schema, return empty
        data = []
        total = 0
        break
      
      case 'TaxRate':
        // TaxRate model not in schema, return empty
        data = []
        total = 0
        break
      
      case 'CashFlowForecast':
        [data, total] = await Promise.all([
          prisma.cashFlowForecast.findMany({ 
            skip: offset, 
            take: limit, 
            orderBy: { date: 'desc' }
          }),
          prisma.cashFlowForecast.count()
        ])
        break
      
      case 'SyncHistory':
        // SyncHistory doesn't exist in schema, return empty for now
        data = []
        total = 0
        break
      
      default:
        return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    const totalPages = Math.ceil(total / pageSize)
    
    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching table data:', error)
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 })
  }
}