'use client'

import { useState } from 'react'
import { ArrowLeft, FileText, Calendar, Package, Hash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { sopData, rules } from '@/lib/sop-data'

export default function SOPTablesPage() {
  const router = useRouter()
  const [year, setYear] = useState<'2024' | '2025'>('2025')
  const [selectedAccount, setSelectedAccount] = useState<string>('')

  const accounts = Object.keys(sopData[year])
  const selectedData = selectedAccount ? sopData[year][selectedAccount] : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/bookkeeping/sop-generator')}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to SOP Generator
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <FileText className="h-8 w-8 mr-3 text-indigo-400" />
              SOP Reference Tables
            </h1>
            <p className="text-gray-400">
              View all Standard Operating Procedures for {year}
            </p>
          </div>
          
          {/* Year Selector */}
          <div className="flex bg-slate-800/30 rounded-lg p-1">
            <button
              onClick={() => setYear('2024')}
              className={`px-4 py-2 rounded-md transition-all ${
                year === '2024'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              2024
            </button>
            <button
              onClick={() => setYear('2025')}
              className={`px-4 py-2 rounded-md transition-all ${
                year === '2025'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              2025
            </button>
          </div>
        </div>
      </div>

      {/* Account Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Hash className="h-4 w-4 inline mr-1" />
          Select Chart of Account
        </label>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="w-full md:w-96 px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Accounts</option>
          {accounts.map(account => (
            <option key={account} value={account}>{account}</option>
          ))}
        </select>
      </div>

      {/* SOP Table */}
      {selectedAccount && selectedData.length > 0 ? (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Service Type
                  </th>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Reference Template
                  </th>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Reference Example
                  </th>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description Template
                  </th>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description Example
                  </th>
                  <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {selectedData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-white">
                      {item.serviceType}
                    </td>
                    <td className="p-4 text-sm text-gray-300 font-mono">
                      {item.referenceTemplate}
                    </td>
                    <td className="p-4 text-sm text-indigo-400 font-mono">
                      {item.referenceExample}
                    </td>
                    <td className="p-4 text-sm text-gray-300 font-mono">
                      {item.descriptionTemplate}
                    </td>
                    <td className="p-4 text-sm text-emerald-400 font-mono">
                      {item.descriptionExample}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {item.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedAccount ? (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
          <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No SOPs Found</h3>
          <p className="text-gray-500">No Standard Operating Procedures defined for this account in {year}</p>
        </div>
      ) : (
        /* All Accounts Summary */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(account => {
            const data = sopData[year][account]
            if (!data || data.length === 0) return null
            
            return (
              <div 
                key={account}
                onClick={() => setSelectedAccount(account)}
                className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <div className="w-1 h-6 bg-indigo-500 rounded-full mr-3" />
                  {account}
                </h3>
                <div className="space-y-2">
                  {data.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="text-indigo-400">{item.serviceType}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  {data.length} SOP{data.length > 1 ? 's' : ''} defined
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SOP Rules */}
      <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <div className="w-1 h-6 bg-amber-500 rounded-full mr-3" />
          SOP Rules & Guidelines
        </h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          {rules.map((rule, index) => (
            <li key={index} className="flex items-start">
              <span className="text-amber-400 mr-2 mt-0.5">•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}