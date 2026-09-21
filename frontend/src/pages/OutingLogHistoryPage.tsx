import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Loader2 } from 'lucide-react';
import { managementApiService } from '../services/api';

interface OutingLogHistoryPageProps {
  onNavigate?: (path: string) => void;
}

interface GateLogEntry {
  id: string;
  studentName: string;
  studentId: string;
  logType: 'GATE_EXIT' | 'GATE_ENTRY' | 'OUTING' | 'EMERGENCY_EXIT';
  timestamp: string;
  status: 'VERIFIED' | 'COMPLETED' | 'OVERDUE' | 'VIOLATION' | 'PENDING';
}

export const OutingLogHistoryPage: React.FC<OutingLogHistoryPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'violations'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('2026-09-09T17:34');
  const [toDate, setToDate] = useState('2026-09-10T17:34');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<GateLogEntry[]>([]);

  const fetchGateLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const historyRes = await managementApiService.getOutingLogHistory({ pageSize: 50 }).catch(() => null);
      if (historyRes && historyRes.success && historyRes.records && historyRes.records.length > 0) {
        const mapped: GateLogEntry[] = historyRes.records.map((r: any) => ({
          id: r.id,
          studentName: r.studentName || 'Student',
          studentId: r.studentJntuNo || '',
          logType: r.movementType === 'ENTRY' ? 'GATE_ENTRY' : r.movementType === 'EXIT' ? 'GATE_EXIT' : 'OUTING',
          timestamp: r.eventTimeFormatted || (r.outDate ? new Date(r.outDate).toLocaleString() : 'Recent'),
          status: (r.status === 'APPROVED' ? 'VERIFIED' : r.status === 'COMPLETED' ? 'COMPLETED' : r.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING') as GateLogEntry['status'],
        }));
        setLogs(mapped);
      } else {
        // Try fallback to outings API directly
        const outingRes = await managementApiService.getOutings({ limit: 50 }).catch(() => null);
        if (outingRes && outingRes.success && outingRes.data && outingRes.data.length > 0) {
          const mapped: GateLogEntry[] = outingRes.data.map((o) => ({
            id: o.id,
            studentName: o.student?.name || 'Unknown Student',
            studentId: o.student?.jntuNo || '',
            logType: (o.passType === 'LOCAL_OUTING' ? 'OUTING' : 'GATE_EXIT') as GateLogEntry['logType'],
            timestamp: o.outDate ? new Date(o.outDate).toLocaleString() : 'Recent',
            status: (o.status === 'OUT' ? 'VERIFIED' : o.status === 'RETURNED' ? 'COMPLETED' : 'PENDING') as GateLogEntry['status'],
          }));
          setLogs(mapped);
        } else {
          setLogs([]);
        }
      }
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateLogs();
  }, [fetchGateLogs]);

  const filteredLogs = logs.filter((log) => {
    if (activeTab === 'violations' && log.status !== 'OVERDUE' && log.status !== 'VIOLATION') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.studentName.toLowerCase().includes(q) ||
        log.studentId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Student Name,Student ID,Log Type,Timestamp,Status']
        .concat(
          filteredLogs.map(
            (l) => `"${l.studentName}","${l.studentId}","${l.logType}","${l.timestamp}","${l.status}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gate_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="outing-log-page" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '2px solid #E2E8F0', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'all' ? '#1E1B4B' : '#64748B',
            borderBottom: activeTab === 'all' ? '3px solid #1E1B4B' : '3px solid transparent',
            marginBottom: '-2px',
          }}
        >
          All Gate Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('violations')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'violations' ? '#1E1B4B' : '#64748B',
            borderBottom: activeTab === 'violations' ? '3px solid #1E1B4B' : '3px solid transparent',
            marginBottom: '-2px',
          }}
        >
          Violations
        </button>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>
        {activeTab === 'all' ? 'All Gate Logs' : 'Gate Violations'}
      </h2>

      {/* Search and Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', maxWidth: '500px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by student name or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '0.9rem',
              outline: 'none',
              backgroundColor: '#FFFFFF',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={exportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#22C55E',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={fetchGateLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1E1B4B',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Date Range Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>From Date</label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                fontSize: '0.85rem',
                color: '#334155',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>To Date</label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                fontSize: '0.85rem',
                color: '#334155',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={fetchGateLogs}
            style={{
              backgroundColor: '#1E1B4B',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFromDate('2026-09-09T17:34');
              setToDate('2026-09-10T17:34');
            }}
            style={{
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #CBD5E1',
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table matching screenshots */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#1E1B4B', color: '#FFFFFF', fontSize: '0.78rem', letterSpacing: '0.05em' }}>
              <th style={{ padding: '1rem', fontWeight: 600 }}>STUDENT</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>LOG TYPE</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>TIMESTAMP</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Loading gate logs...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
                  No gate movement logs recorded for the selected criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                  }}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9rem' }}>{log.studentName}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>ID: {log.studentId}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          log.logType === 'GATE_EXIT'
                            ? '#FEF3C7'
                            : log.logType === 'GATE_ENTRY'
                            ? '#DCFCE7'
                            : '#E0E7FF',
                        color:
                          log.logType === 'GATE_EXIT'
                            ? '#92400E'
                            : log.logType === 'GATE_ENTRY'
                            ? '#166534'
                            : '#3730A3',
                      }}
                    >
                      {log.logType}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.88rem', color: '#334155' }}>
                    {log.timestamp}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          log.status === 'VERIFIED'
                            ? '#DCFCE7'
                            : log.status === 'COMPLETED'
                            ? '#E0E7FF'
                            : log.status === 'OVERDUE'
                            ? '#FEE2E2'
                            : '#FEF9C3',
                        color:
                          log.status === 'VERIFIED'
                            ? '#15803D'
                            : log.status === 'COMPLETED'
                            ? '#4338CA'
                            : log.status === 'OVERDUE'
                            ? '#B91C1C'
                            : '#A16207',
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer with pagination matching screenshot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderTop: '1px solid #E2E8F0',
            fontSize: '0.85rem',
            color: '#64748B',
          }}
        >
          <div>Showing 1 to {filteredLogs.length} of 50 entries</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                border: 'none',
                background: 'none',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                color: currentPage === 1 ? '#CBD5E1' : '#1E1B4B',
                fontWeight: 500,
              }}
            >
              Previous
            </button>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#1E1B4B',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              1
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#1E1B4B',
                fontWeight: 500,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
