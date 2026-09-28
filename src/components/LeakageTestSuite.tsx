import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileCode,
  Download,
  AlertTriangle,
  Bug,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { LeakageSuiteSummary, LeakageTestResult } from '../types/rag';

interface LeakageTestSuiteProps {
  onOpenResumeModal: () => void;
}

export const LeakageTestSuite: React.FC<LeakageTestSuiteProps> = ({ onOpenResumeModal }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<LeakageSuiteSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<LeakageTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSuite = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.runTestSuite();
      setSummary(res);
    } catch (err: any) {
      setError(err.message || 'Failed to run test suite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run suite on first mount to populate numbers immediately
    handleRunSuite();
  }, []);

  const filteredResults =
    summary?.results.filter(
      (r) => selectedCategory === 'all' || r.category === selectedCategory
    ) || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Adversarial Leakage Test Suite (CI Runner)
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Automated Verification
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Verifies zero cross-tenant leakage across adversarial queries, prompt injections, request-body spoofing attacks, vertical privilege escalation attempts, and dynamic permission revocations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenResumeModal}
              className="py-2 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              Copy Resume Line
            </button>

            <button
              onClick={handleRunSuite}
              disabled={loading}
              className="inline-flex items-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Adversarial Suite</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 font-medium">Cross-Tenant Leaks</div>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
                {summary.cross_tenant_leaks}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Target: Exactly Zero</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 font-medium">Test Suite Pass Rate</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {summary.passed_tests}/{summary.total_tests}{' '}
                <span className="text-xs font-normal text-emerald-600">
                  ({Math.round((summary.passed_tests / summary.total_tests) * 100)}%)
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Zero security regressions</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 font-medium">Pre-Filter Overhead</div>
              <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">
                {summary.avg_pre_filter_overhead_ms} ms
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Payload index lookup</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 font-medium">Post-Filter Latency</div>
              <div className="text-xl font-bold font-mono text-amber-600 mt-0.5">
                {summary.avg_post_filter_overhead_ms} ms
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Global scan + discard</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-500 font-medium">Revocation Delay</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {summary.permission_revocation_delay_ms} ms
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Immediate vector update</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs & Test Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'All Tests' },
              { id: 'cross_tenant', label: 'Cross-Tenant' },
              { id: 'privilege_escalation', label: 'Privilege Escalation' },
              { id: 'token_spoofing', label: 'Body Tampering' },
              { id: 'prompt_injection', label: 'Prompt Injection' },
              { id: 'revocation', label: 'Revocation' },
              { id: 'ingestion_invariant', label: 'Ingestion Invariant' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1.5 px-3 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {filteredResults.length} test assertions
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Test Case & Assertion</th>
                <th className="py-2.5 px-4">Persona</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Result Verdict</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredResults.map((test) => (
                <tr key={test.test_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 shrink-0">
                    {test.status === 'PASSED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 font-mono">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 font-mono">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        FAILED
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 max-w-sm">
                    <div className="font-medium text-slate-900">{test.test_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                      "{test.query}"
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    <div>{test.user_name}</div>
                    <div className="text-[10px] text-slate-400">{test.tenant_id}</div>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {test.latency_ms} ms
                  </td>

                  <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs">
                    <span className="text-emerald-700">{test.reason}</span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedResult(test)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedResult.test_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-slate-400 hover:text-slate-600 text-xs py-1 px-2 font-mono"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Query:</span>
                <p className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] mt-1">
                  {selectedResult.query}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 font-medium">Executing Persona:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">{selectedResult.user_name}</div>
                  <div className="text-slate-500 font-mono">{selectedResult.tenant_id}</div>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 font-medium">Execution Latency:</span>
                  <div className="font-semibold text-slate-800 mt-0.5 font-mono">
                    {selectedResult.latency_ms} ms
                  </div>
                  <div className="text-emerald-600 font-mono">Leaked Chunks: {selectedResult.leaked_chunks_count}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Security Invariant Assertion:</span>
                <p className="text-slate-700 bg-emerald-50 p-2.5 rounded border border-emerald-100 text-[11px] mt-1">
                  {selectedResult.reason}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Retrieved Chunk IDs:</span>
                <p className="text-slate-600 font-mono text-[10px] mt-1">
                  {selectedResult.retrieved_chunk_ids.length > 0
                    ? selectedResult.retrieved_chunk_ids.join(', ')
                    : 'None (Pre-filter blocked all candidate matches before vector similarity evaluation)'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="py-1.5 px-4 bg-slate-900 text-white rounded-lg text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
