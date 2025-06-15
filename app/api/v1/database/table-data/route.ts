import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableName = searchParams.get('table')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

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
        [data, total] = await Promise.all([
          prisma.contact.findMany({ skip: offset, take: limit, orderBy: { name: 'asc' } }),
          prisma.contact.count()
        ])
        break
      
      case 'TaxRate':
        [data, total] = await Promise.all([
          prisma.taxRate.findMany({ skip: offset, take: limit, orderBy: { name: 'asc' } }),
          prisma.taxRate.count()
        ])
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
        [data, total] = await Promise.all([
          prisma.syncHistory.findMany({ 
            skip: offset, 
            take: limit, 
            orderBy: { syncedAt: 'desc' }
          }),
          prisma.syncHistory.count()
        ])
        break
      
      default:
        return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    return NextResponse.json({
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Error fetching table data:', error)
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 })
  }
}