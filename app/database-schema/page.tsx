'use client'

import { useState, useEffect } from 'react';
import { Database, Table, Hash, Type, Calendar, ToggleLeft, Key, FileText } from 'lucide-react';
import { UnifiedPageHeader } from '@/components/ui/unified-page-header';
import { DatabaseSchema } from '@/components/ui/database-schema';
import { DataTable, Column } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton';

interface TableData {
  columns: string[];
  records: any[];
}

export default function DatabaseSchemaPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/database/table/${tableName}?limit=20`);
      if (response.ok) {
        const data = await response.json();
        const columns = data.records.length > 0 ? Object.keys(data.records[0]) : [];
        setTableData({
          columns,
          records: data.records,
        });
      }
    } catch (error) {
      console.error('Failed to fetch table data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    fetchTableData(tableName);
  };

  // Generate columns for the DataTable dynamically
  const generateColumns = (): Column<any>[] => {
    if (!tableData || tableData.columns.length === 0) return [];
    return tableData.columns.map(col => ({
      key: col,
      header: col.replace(/([A-Z])/g, ' $1').trim(), // Add space before uppercase letters
    }));
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <UnifiedPageHeader
        title="Database Schema"
        description="Explore the structure and contents of the local application database."
        showAuthStatus={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <DatabaseSchema onTableClick={handleTableClick} />
        </div>
        
        <div className="lg:col-span-2">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
            {selectedTable ? (
              <>
                <h3 className="text-xl font-semibold text-white mb-4">
                  {selectedTable} Data Preview
                </h3>
                {loading ? (
                  <SkeletonTable rows={5} />
                ) : tableData && tableData.records.length > 0 ? (
                  <DataTable
                    data={tableData.records.map((r, i) => ({ ...r, id: r.id || `${selectedTable}-${i}` }))}
                    columns={generateColumns()}
                    isLoading={loading}
                    stickyHeader
                  />
                ) : (
                  <p className="text-gray-400">No data to display for this table.</p>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Database className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg text-white">Select a table</h3>
                <p className="text-gray-400">Choose a table on the left to view its schema and preview data.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}