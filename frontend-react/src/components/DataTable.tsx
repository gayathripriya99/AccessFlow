import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-4 py-2 text-left font-semibold text-gray-900">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-middle">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-4 py-6 text-center text-gray-500">{emptyMessage}</p>}
    </div>
  );
}
