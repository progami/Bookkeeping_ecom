'use client'

import { useState } from 'react'
import { 
  Database, Table, Hash, Calendar, 
  ToggleLeft, Type, FileText, Key, ChevronDown, ChevronUp
} from 'lucide-react'

const SCHEMA_INFO = {
  GLAccount: {
    description: 'Chart of Accounts from Xero',
    icon: '📊',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: true },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'systemAccount', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'class', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  BankAccount: {
    description: 'Bank accounts synced from Xero',
    icon: '🏦',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: true },
      { name: 'currencyCode', type: 'String', isPrimary: false, isOptional: true },
      { name: 'balance', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'balanceLastUpdated', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  BankTransaction: {
    description: 'Bank transactions with categorization',
    icon: '💳',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroTransactionId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'bankAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'isReconciled', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncedInvoice: {
    description: 'Invoices synced from Xero for cash flow',
    icon: '📄',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amountDue', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'total', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncLog: {
    description: 'History of data synchronization operations',
    icon: '🔄',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'recordsCreated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'recordsUpdated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
    ]
  }
}

export function DatabaseSchema() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'String': return <Type className="h-4 w-4 text-blue-400" />
      case 'Int':
      case 'Float': return <Hash className="h-4 w-4 text-green-400" />
      case 'Boolean': return <ToggleLeft className="h-4 w-4 text-purple-400" />
      case 'DateTime': return <Calendar className="h-4 w-4 text-amber-400" />
      default: return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-white">Database Schema</h3>
          <span className="text-sm text-gray-400">({Object.keys(SCHEMA_INFO).length} tables)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tables List */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Tables</h4>
              <div className="space-y-2">
                {Object.entries(SCHEMA_INFO).map(([name, info]) => (
                  <div
                    key={name}
                    onClick={() => setSelectedTable(name)}
                    className={`p-3 bg-slate-900/50 rounded-lg cursor-pointer transition-all ${
                      selectedTable === name
                        ? 'ring-2 ring-teal-500 bg-slate-900/80'
                        : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{info.icon}</span>
                      <div className="flex-1">
                        <h5 className="font-medium text-white text-sm">{name}</h5>
                        <p className="text-xs text-gray-400">{info.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Table Details */}
            <div>
              {selectedTable && SCHEMA_INFO[selectedTable as keyof typeof SCHEMA_INFO] ? (
                <>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    {selectedTable} Columns
                  </h4>
                  <div className="space-y-1">
                    {SCHEMA_INFO[selectedTable as keyof typeof SCHEMA_INFO].columns.map((col) => (
                      <div 
                        key={col.name} 
                        className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {col.isPrimary && <Key className="h-3 w-3 text-amber-400" />}
                          <span className="font-mono text-white">{col.name}</span>
                          {col.isOptional && <span className="text-xs text-gray-500">?</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {getTypeIcon(col.type)}
                          <span className="text-gray-400 text-xs">{col.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Select a table to view its schema
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}