'use client';

import { useState } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  headerActions?: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  loading = false,
  emptyMessage = 'No data found.',
  onRowClick,
  actions,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  headerActions,
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-dark-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Table Header with Search and Actions */}
      {(onSearchChange || headerActions) && (
        <div className="px-6 py-4 border-b border-dark-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {onSearchChange && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm w-full sm:w-64"
              />
            </div>
          )}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-50 border-b border-dark-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:bg-dark-100 select-none' : ''
                  } ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-primary-600">
                        {sortDir === 'asc' ? ' \u2191' : ' \u2193'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-100">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-dark-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((item, idx) => (
                <tr
                  key={String(item[keyField]) || idx}
                  className={`hover:bg-dark-50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${idx % 2 === 1 ? 'bg-dark-50/50' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 text-sm text-dark-700 ${col.className || ''}`}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
