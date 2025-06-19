'use client';

import { useState } from 'react';
import { Calendar, Clock, AlertCircle, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SyncConfigurationProps {
  onSync: (config: SyncConfig) => void;
  isLoading?: boolean;
  className?: string;
}

export interface SyncConfig {
  syncType: 'historical';
  historicalSyncFromDate?: string;
  entities?: string[];
}

// Remove syncOptions array since we're not using RadioGroup anymore

// Dynamic date calculation - Xero was founded in 2006, but practical data starts around 2015
const getEarliestReasonableDate = () => {
  const currentYear = new Date().getFullYear();
  // Use 10 years ago or 2015, whichever is more recent
  const tenYearsAgo = currentYear - 10;
  const earliestYear = Math.max(2015, tenYearsAgo);
  return earliestYear;
};

const historicalOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 3 months' },
  { value: '1y', label: 'Last year' },
  { value: '3y', label: 'Last 3 years' },
  { value: 'all', label: `All history (from ${getEarliestReasonableDate()})` },
  { value: 'custom', label: 'Custom date' },
];

export function SyncConfiguration({ onSync, isLoading, className }: SyncConfigurationProps) {
  const [historicalOption, setHistoricalOption] = useState('1y');
  const [customHistoricalDate, setCustomHistoricalDate] = useState('');

  const calculateHistoricalDate = (option: string): string => {
    const now = new Date();
    switch (option) {
      case '30d':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return thirtyDaysAgo.toISOString();
      case '90d':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return threeMonthsAgo.toISOString();
      case '1y':
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return oneYearAgo.toISOString();
      case '3y':
        const threeYearsAgo = new Date(now);
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        return threeYearsAgo.toISOString();
      case 'all':
        const earliestYear = getEarliestReasonableDate();
        return new Date(`${earliestYear}-01-01`).toISOString();
      default:
        return customHistoricalDate || new Date().toISOString();
    }
  };

  const handleSync = () => {
    const config: SyncConfig = {
      syncType: 'historical',
      entities: ['accounts', 'transactions', 'invoices', 'bills'],
      historicalSyncFromDate: calculateHistoricalDate(historicalOption)
    };

    onSync(config);
  };

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>Historical Data Import</CardTitle>
        <CardDescription>
          Import historical data from Xero to populate your database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Historical Import Description */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-brand-emerald mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-white mb-1">Historical Data Import</h3>
              <p className="text-sm text-gray-400 mb-3">
                Import all your Xero data from a specific date in the past. Use this for initial setup or to fill in missing historical data.
              </p>
              
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This may take several minutes for accounts with many transactions. The sync will continue in the background.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="space-y-3">
          <Label className="text-base">Select time period to import:</Label>
          <RadioGroup value={historicalOption} onValueChange={setHistoricalOption}>
            {historicalOptions.map((histOption) => (
              <div 
                key={histOption.value} 
                className="flex items-center space-x-2 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/50 hover:border-slate-600 transition-all"
                onClick={() => setHistoricalOption(histOption.value)}
              >
                <RadioGroupItem value={histOption.value} id={histOption.value} />
                <Label htmlFor={histOption.value} className="cursor-pointer flex-1">
                  {histOption.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          
          {historicalOption === 'custom' && (
            <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
              <Label htmlFor="historical-date">Start date</Label>
              <Input
                id="historical-date"
                type="date"
                value={customHistoricalDate ? format(new Date(customHistoricalDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => setCustomHistoricalDate(e.target.value)}
                className="mt-2"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
              <p className="text-xs text-gray-500 mt-2">
                Data will be imported from this date to today
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleSync} 
            disabled={isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Start Sync'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}