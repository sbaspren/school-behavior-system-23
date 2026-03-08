import React from 'react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  columns: Column[];
  data: any[];
  emptyMessage?: string;
}

const DataTable: React.FC<Props> = ({ columns, data, emptyMessage = 'لا توجد بيانات' }) => {
  if (data.length === 0) {
    return <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f2f7', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
