import React, { useState, useEffect } from 'react';
import {
  FileSearch,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Calendar,
  User,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Database,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { AuditLogEntry, Document } from '../types/rag';

interface AuditLogViewerProps {
  documents: Document[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ documents }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTenant, setFilterTenant] = useState<string>('');
  const [filterVerdict, setFilterVerdict] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 30-Day Document History Forensic Tool
  const [selectedDocId, setSelectedDocId] = useState<string>(
    documents[0]?.id || 'doc_acme_comp'
  );
  const [docHistoryDays, setDocHistoryDays] = useState<number>(30);
  const [docHistory, setDocHistory] = useState<{
    documentId: string;
    totalRetrievals: number;
    uniqueUsers: Array<{
      userId: string;
      userName: string;
      tenantId: string;
      roles: string[];
      lastRetrieved: string;
      accessCount: number;
    }>;
    recentLogs: AuditLogEntry[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAuditLogs({
        tenantId: filterTenant || undefined,
        verdict: filterVerdict || undefined,
        query: searchQuery || undefined,
      });
      setLogs(res.logs);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocHistory = async (docId: string, days: number = 30) => {
    if (!docId) return;
    setHistoryLoading(true);
    try {
      const res = await apiClient.getDocHistory(docId, days);
      setDocHistory(res);
    } catch (err: any) {
      console.error('Failed to get doc history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterTenant, filterVerdict, searchQuery]);

  useEffect(() => {
    if (selectedDocId) {
      fetchDocHistory(selectedDocId, docHistoryDays);
    }
  }, [selectedDocId, docHistoryDays]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_log_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Section: 30-Day Forensic Inspection Tool */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <FileSearch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                30-Day Document Access Inspector
              </h2>
              <p className="text-xs text-slate-500">
                Answers: "Who retrieved document X in the last 30 days?" for compliance auditing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="text-xs font-mono py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.id})
                </option>
              ))}
            </select>

            <select
              value={docHistoryDays}
              onChange={(e) => setDocHistoryDays(Number(e.target.value))}
              className="text-xs font-mono py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {/* History Results Panel */}
        {docHistory && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Stats Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Document ID:</span>
              <div className="text-xs font-mono font-bold text-slate-900 truncate">
                {docHistory.documentId}
              </div>
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {docHistory.totalRetrievals}
                </span>
                <span className="text-xs text-slate-500">total access events</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Audited across {docHistory.uniqueUsers.length} authorized user(s)
              </div>
            </div>

            {/* Unique Users Access Breakdown */}
            <div className="md:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <span className="text-[11px] text-slate-500 font-medium block">
                Authorized Personnel Who Retrieved This Document:
              </span>
              {docHistory.uniqueUsers.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-2">
                  No retrievals recorded for this document in the selected timeframe.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {docHistory.uniqueUsers.map((u) => (
                    <div
                      key={u.userId}
                      className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{u.userName}</span>
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {u.accessCount} retrievals
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {u.tenantId} · [{u.roles.join(', ')}]
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Last access: {new Date(u.lastRetrieved).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table Filters & Export */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Append-Only Forensic Retrieval Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Immutable record of request IDs, verified token claims, returned chunk IDs, and latency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Verdict */}
            <select
              value={filterVerdict}
              onChange={(e) => setFilterVerdict(e.target.value)}
              className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="">All Verdicts</option>
              <option value="ALLOWED">ALLOWED</option>
              <option value="BLOCKED_ZERO_RESULTS">BLOCKED</option>
              <option value="DEFENSE_IN_DEPTH_BLOCKED">DEFENSE_IN_DEPTH_ALERT</option>
              <option value="CROSS_TENANT_ATTEMPT">CROSS_TENANT_ATTEMPT</option>
            </select>

            {/* Filter Tenant */}
            <select
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="">All Tenants</option>
              <option value="tenant_acme">Acme Corp</option>
              <option value="tenant_apexbio">ApexBio</option>
              <option value="tenant_horizon">Horizon</option>
            </select>

            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="py-2.5 px-4">Request ID & Timestamp</th>
                <th className="py-2.5 px-4">User & Tenant</th>
                <th className="py-2.5 px-4">Query</th>
                <th className="py-2.5 px-4">Verdict</th>
                <th className="py-2.5 px-4">Returned Docs</th>
                <th className="py-2.5 px-4">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 shrink-0 font-mono text-[11px]">
                    <div className="font-semibold text-slate-800">{log.request_id}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    <div className="font-semibold text-slate-900">{log.user_name}</div>
                    <div className="text-[10px] text-slate-400">
                      {log.tenant_id} · [{log.roles.join(', ')}]
                    </div>
                  </td>

                  <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-700 font-mono">
                    "{log.query}"
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded border inline-block ${
                        log.verdict === 'ALLOWED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : log.verdict === 'DEFENSE_IN_DEPTH_BLOCKED'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : log.verdict === 'CROSS_TENANT_ATTEMPT'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.verdict}
                    </span>
                    {log.security_alert && (
                      <div className="text-[10px] text-rose-600 mt-1 truncate max-w-xs font-mono">
                        {log.security_alert}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {log.returned_doc_ids.length > 0 ? (
                      <div className="space-y-0.5">
                        {log.returned_doc_ids.map((id) => (
                          <div key={id} className="text-indigo-600">
                            {id}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None (0 chunks)</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    <div>{log.filter_latency_ms} ms</div>
                    <div className="text-[10px] text-slate-400">{log.model}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
