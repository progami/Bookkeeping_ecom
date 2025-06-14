import { prisma } from '@/lib/db';
import { XeroClient, Organisation } from 'xero-node';
import { 
  addDays, 
  addMonths, 
  startOfMonth,
  endOfMonth,
  setDate,
  getQuarter,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  parse,
  format
} from 'date-fns';

interface TaxObligation {
  type: 'VAT' | 'PAYE_NI' | 'CORPORATION_TAX';
  dueDate: Date;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  reference?: string;
  notes?: string;
}

interface OrganizationDetails {
  financialYearEnd: { month: number; day: number };
  vatScheme: 'STANDARD' | 'CASH' | 'FLAT_RATE' | 'NONE';
  vatReturns: 'MONTHLY' | 'QUARTERLY';
  registrationNumber?: string;
}

export class UKTaxCalculator {
  private xero?: XeroClient;
  private tenantId?: string;

  constructor(xero?: XeroClient, tenantId?: string) {
    this.xero = xero;
    this.tenantId = tenantId;
  }

  async calculateUpcomingTaxes(days: number): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    const today = new Date();
    const endDate = addDays(today, days);

    // Get organization details if Xero client is available
    const orgDetails = this.xero && this.tenantId 
      ? await this.getOrganizationDetails()
      : this.getDefaultOrganizationDetails();

    // Calculate VAT obligations
    const vatObligations = await this.calculateVATObligations(today, endDate, orgDetails);
    obligations.push(...vatObligations);

    // Calculate PAYE/NI obligations
    const payeObligations = await this.calculatePAYEObligations(today, endDate);
    obligations.push(...payeObligations);

    // Calculate Corporation Tax obligations
    const ctObligations = await this.calculateCorporationTaxObligations(today, endDate, orgDetails);
    obligations.push(...ctObligations);

    return obligations;
  }

  private async getOrganizationDetails(): Promise<OrganizationDetails> {
    if (!this.xero || !this.tenantId) {
      return this.getDefaultOrganizationDetails();
    }

    try {
      const response = await this.xero.accountingApi.getOrganisations(this.tenantId);
      const org = response.body.organisations?.[0];
      
      if (!org) {
        return this.getDefaultOrganizationDetails();
      }

      // Parse financial year end
      let financialYearEnd = { month: 3, day: 31 }; // Default March 31
      if (org.periodLockDate) {
        const lockDate = new Date(org.periodLockDate);
        financialYearEnd = {
          month: lockDate.getMonth() + 1,
          day: lockDate.getDate()
        };
      }

      // Determine VAT scheme from tax settings
      const vatScheme = org.salesTaxBasis === Organisation.SalesTaxBasisEnum.CASH ? 'CASH' : 'STANDARD';
      const vatReturns = org.salesTaxPeriod === Organisation.SalesTaxPeriodEnum.MONTHLY ? 'MONTHLY' : 'QUARTERLY';

      return {
        financialYearEnd,
        vatScheme,
        vatReturns,
        registrationNumber: org.registrationNumber
      };
    } catch (error) {
      console.error('Error fetching organization details:', error);
      return this.getDefaultOrganizationDetails();
    }
  }

  private getDefaultOrganizationDetails(): OrganizationDetails {
    return {
      financialYearEnd: { month: 3, day: 31 }, // March 31
      vatScheme: 'STANDARD',
      vatReturns: 'QUARTERLY',
    };
  }

  private async calculateVATObligations(
    startDate: Date,
    endDate: Date,
    orgDetails: OrganizationDetails
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get VAT liability from balance sheet accounts
    const vatLiability = await this.getVATLiability();
    
    if (orgDetails.vatReturns === 'QUARTERLY') {
      // Calculate quarterly VAT obligations
      let currentDate = startDate;
      
      while (currentDate <= endDate) {
        const quarterEnd = endOfQuarter(currentDate);
        const dueDate = addDays(quarterEnd, 37); // 1 month + 7 days
        
        if (dueDate >= startDate && dueDate <= endDate) {
          obligations.push({
            type: 'VAT',
            dueDate,
            amount: vatLiability / 4, // Estimate quarterly portion
            periodStart: startOfQuarter(currentDate),
            periodEnd: quarterEnd,
            reference: `VAT Q${getQuarter(currentDate)} ${format(currentDate, 'yyyy')}`,
            notes: 'Quarterly VAT return'
          });
        }
        
        currentDate = addQuarters(currentDate, 1);
      }
    } else {
      // Monthly VAT returns
      let currentDate = startOfMonth(startDate);
      
      while (currentDate <= endDate) {
        const monthEnd = endOfMonth(currentDate);
        const dueDate = addDays(monthEnd, 37); // 1 month + 7 days
        
        if (dueDate >= startDate && dueDate <= endDate) {
          obligations.push({
            type: 'VAT',
            dueDate,
            amount: vatLiability / 12, // Estimate monthly portion
            periodStart: currentDate,
            periodEnd: monthEnd,
            reference: `VAT ${format(currentDate, 'MMM yyyy')}`,
            notes: 'Monthly VAT return'
          });
        }
        
        currentDate = addMonths(currentDate, 1);
      }
    }

    return obligations;
  }

  private async calculatePAYEObligations(
    startDate: Date,
    endDate: Date
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get PAYE/NI liabilities from balance sheet
    const payeLiability = await this.getPAYELiability();
    
    // PAYE is due by 22nd of following month (19th if paying electronically)
    let currentDate = startOfMonth(startDate);
    
    while (currentDate <= endDate) {
      const dueDate = setDate(addMonths(currentDate, 1), 22);
      
      if (dueDate >= startDate && dueDate <= endDate) {
        obligations.push({
          type: 'PAYE_NI',
          dueDate,
          amount: payeLiability, // Monthly amount
          periodStart: currentDate,
          periodEnd: endOfMonth(currentDate),
          reference: `PAYE/NI ${format(currentDate, 'MMM yyyy')}`,
          notes: 'Monthly PAYE and NI payment'
        });
      }
      
      currentDate = addMonths(currentDate, 1);
    }

    return obligations;
  }

  private async calculateCorporationTaxObligations(
    startDate: Date,
    endDate: Date,
    orgDetails: OrganizationDetails
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get annual profit estimate
    const annualProfit = await this.getAnnualProfitEstimate();
    
    // Determine tax rate
    const taxRate = annualProfit > 250000 ? 0.25 : 0.19;
    const taxAmount = annualProfit * taxRate;
    
    // Calculate year end for current and next year
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear; year <= currentYear + 1; year++) {
      const yearEnd = new Date(
        year,
        orgDetails.financialYearEnd.month - 1,
        orgDetails.financialYearEnd.day
      );
      
      // CT is due 9 months and 1 day after year end
      const dueDate = addDays(addMonths(yearEnd, 9), 1);
      
      if (dueDate >= startDate && dueDate <= endDate) {
        obligations.push({
          type: 'CORPORATION_TAX',
          dueDate,
          amount: taxAmount,
          periodStart: addDays(yearEnd, -364), // Approximate year start
          periodEnd: yearEnd,
          reference: `CT FY${format(yearEnd, 'yyyy')}`,
          notes: `Corporation tax for year ending ${format(yearEnd, 'dd/MM/yyyy')}`
        });
      }
    }

    return obligations;
  }

  private async getVATLiability(): Promise<number> {
    // Try to get from GL accounts
    const vatAccount = await prisma.gLAccount.findFirst({
      where: {
        OR: [
          { code: '820' }, // Common VAT liability code
          { name: { contains: 'VAT' } },
          { name: { contains: 'GST' } }
        ],
        class: 'LIABILITY'
      }
    });

    if (vatAccount) {
      // Get balance from transactions
      const transactions = await prisma.bankTransaction.findMany({
        where: {
          accountCode: vatAccount.code,
          status: 'AUTHORISED'
        }
      });

      return Math.abs(
        transactions.reduce((sum, t) => 
          sum + (t.type === 'SPEND' ? -t.amount : t.amount), 0
        )
      );
    }

    // Fallback: estimate based on recent transactions
    const recentTransactions = await prisma.bankTransaction.findMany({
      where: {
        date: { gte: addMonths(new Date(), -3) },
        status: 'AUTHORISED'
      }
    });

    const totalSales = recentTransactions
      .filter(t => t.type === 'RECEIVE')
      .reduce((sum, t) => sum + t.amount, 0);

    // Estimate VAT at 20% of sales
    return totalSales * 0.2 / 3; // Monthly average
  }

  private async getPAYELiability(): Promise<number> {
    // Try to get from GL accounts
    const payeAccounts = await prisma.gLAccount.findMany({
      where: {
        OR: [
          { code: { in: ['814', '825', '826'] } }, // Common PAYE/NI codes
          { name: { contains: 'PAYE' } },
          { name: { contains: 'National Insurance' } }
        ],
        class: 'LIABILITY'
      }
    });

    if (payeAccounts.length > 0) {
      const codes = payeAccounts.map(a => a.code);
      const transactions = await prisma.bankTransaction.findMany({
        where: {
          accountCode: { in: codes },
          status: 'AUTHORISED',
          date: { gte: addMonths(new Date(), -1) }
        }
      });

      return Math.abs(
        transactions.reduce((sum, t) => 
          sum + (t.type === 'SPEND' ? -t.amount : t.amount), 0
        )
      );
    }

    // Fallback: estimate based on payroll expenses
    const payrollExpenses = await prisma.bankTransaction.findMany({
      where: {
        OR: [
          { description: { contains: 'salary' } },
          { description: { contains: 'payroll' } },
          { description: { contains: 'wages' } }
        ],
        type: 'SPEND',
        status: 'AUTHORISED',
        date: { gte: addMonths(new Date(), -1) }
      }
    });

    const totalPayroll = payrollExpenses.reduce((sum, t) => sum + t.amount, 0);
    
    // Estimate PAYE/NI at 30% of gross payroll
    return totalPayroll * 0.3;
  }

  private async getAnnualProfitEstimate(): Promise<number> {
    // Get revenue and expenses for last 12 months
    const startDate = addMonths(new Date(), -12);
    
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: { gte: startDate },
        status: 'AUTHORISED'
      }
    });

    const revenue = transactions
      .filter(t => t.type === 'RECEIVE')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'SPEND')
      .reduce((sum, t) => sum + t.amount, 0);

    return Math.max(0, revenue - expenses);
  }

  // Helper method to store calculated tax obligations
  async storeTaxObligations(obligations: TaxObligation[]): Promise<void> {
    for (const obligation of obligations) {
      // Check if obligation already exists
      const existing = await prisma.taxObligation.findFirst({
        where: {
          type: obligation.type,
          dueDate: obligation.dueDate,
          status: 'PENDING'
        }
      });

      if (!existing) {
        await prisma.taxObligation.create({
          data: {
            ...obligation,
            status: 'PENDING'
          }
        });
      }
    }
  }

  // Calculate tax payments for a specific date range
  async getTaxPaymentsForDateRange(startDate: Date, endDate: Date): Promise<TaxObligation[]> {
    const obligations = await prisma.taxObligation.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'PENDING'
      },
      orderBy: { dueDate: 'asc' }
    });

    return obligations.map(ob => ({
      type: ob.type as 'VAT' | 'PAYE_NI' | 'CORPORATION_TAX',
      dueDate: ob.dueDate,
      amount: ob.amount,
      periodStart: ob.periodStart || undefined,
      periodEnd: ob.periodEnd || undefined,
      reference: ob.reference || undefined,
      notes: ob.notes || undefined
    }));
  }
}