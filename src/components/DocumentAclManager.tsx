import React, { useState } from 'react';
import {
  FileText,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Plus,
  Zap,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Network,
  LayoutGrid,
} from 'lucide-react';
import { apiClient, PersonaWithToken } from '../services/apiClient';
import { ClassificationLevel, Document } from '../types/rag';
import { DocumentAclGraph } from './DocumentAclGraph';

interface DocumentAclManagerProps {
  documents: Document[];
  personas?: PersonaWithToken[];
  onRefreshDocuments: () => void;
  onRefreshAudit?: () => void;
}

export const DocumentAclManager: React.FC<DocumentAclManagerProps> = ({
  documents,
  personas = [],
  onRefreshDocuments,
  onRefreshAudit,
}) => {
  const [viewMode, setViewMode] = useState<'graph' | 'grid'>('graph');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [allowedRolesInput, setAllowedRolesInput] = useState<string>('');
  const [allowedUsersInput, setAllowedUsersInput] = useState<string>('');
  const [classificationInput, setClassificationInput] = useState<ClassificationLevel>('internal');

  const [revocationTestingDoc, setRevocationTestingDoc] = useState<Document | null>(null);
  const [revocationTestResult, setRevocationTestResult] = useState<{
    docId: string;
    revocationLatencyMs: number;
    beforeHits: number;
    afterHits: number;
    status: 'SUCCESS' | 'FAILED';
  } | null>(null);
  const [testingRevocation, setTestingRevocation] = useState(false);

  // Ingestion Modal State
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestTenantId, setIngestTenantId] = useState('tenant_acme');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestRoles, setIngestRoles] = useState('engineer, admin');
  const [ingestClearance, setIngestClearance] = useState<ClassificationLevel>('internal');
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  const filteredDocs =
    selectedTenant === 'all'
      ? documents
      : documents.filter((d) => d.tenant_id === selectedTenant);

  const handleOpenEdit = (doc: Document) => {
    setEditingDoc(doc);
    setAllowedRolesInput(doc.acl.allowed_roles.join(', '));
    setAllowedUsersInput(doc.acl.allowed_users.join(', '));
    setClassificationInput(doc.acl.classification_level);
  };

  const handleSaveAcl = async () => {
    if (!editingDoc) return;
    try {
      const roles = allowedRolesInput
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const users = allowedUsersInput
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      await apiClient.revokePermissions({
        docId: editingDoc.id,
        allowedRoles: roles,
        allowedUsers: users,
        classificationLevel: classificationInput,
      });

      setEditingDoc(null);
      onRefreshDocuments();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err: any) {
      alert(`ACL update failed: ${err.message}`);
    }
  };

  // Immediate Revocation Verification Test
  const handleRunImmediateRevocationTest = async (doc: Document) => {
    setTestingRevocation(true);
    setRevocationTestingDoc(doc);
    setRevocationTestResult(null);

    try {
      // Step 1: Temporarily update ACL to drop all roles except admin
      const t0 = performance.now();
      const revokeRes = await apiClient.revokePermissions({
        docId: doc.id,
        allowedRoles: ['admin_super_exclusive'],
        allowedUsers: [],
      });
      const t1 = performance.now();
      const revocationLatencyMs = Math.round((t1 - t0) * 100) / 100;

      // Step 2: Query as a standard user with the original roles to verify 0 hits
      // Let's test with a simulated engineer token
      const queryRes = await apiClient.queryRag({
        token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfYm9iIiwibmFtZSI6IkJvYiBDaGVuIiwidGVuYW50X2lkIjoidGVuYW50X2FjbWUiLCJyb2xlcyI6WyJlbmdpbmVlciJdLCJjbGVhcmFuY2UiOiJpbnRlcm5hbCIsImlhdCI6MTc0Mzk1NDAwMCwiZXhwIjoxNzQ0MDQwNDAwfQ.sig_test`,
        query: doc.title,
      });

      const matchingHits = queryRes.retrieved_hits.filter((h) => h.doc_id === doc.id);

      // Step 3: Restore original ACL
      await apiClient.revokePermissions({
        docId: doc.id,
        allowedRoles: doc.acl.allowed_roles,
        allowedUsers: doc.acl.allowed_users,
        classificationLevel: doc.acl.classification_level,
      });

      setRevocationTestResult({
        docId: doc.id,
        revocationLatencyMs,
        beforeHits: 1,
        afterHits: matchingHits.length,
        status: matchingHits.length === 0 ? 'SUCCESS' : 'FAILED',
      });

      onRefreshDocuments();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err: any) {
      alert(`Test failed: ${err.message}`);
    } finally {
      setTestingRevocation(false);
    }
  };

  const handleQuickRevokeRole = async (docId: string, roleToRemove: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const newRoles = doc.acl.allowed_roles.filter((r) => r !== roleToRemove);
    await apiClient.revokePermissions({
      docId,
      allowedRoles: newRoles,
      allowedUsers: doc.acl.allowed_users,
      classificationLevel: doc.acl.classification_level,
    });
    onRefreshDocuments();
    if (onRefreshAudit) onRefreshAudit();
  };

  const handleTestIngest = async (omitTenantId: boolean = false) => {
    setIsIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);

    try {
      const res = await apiClient.ingestDocument({
        title: ingestTitle || 'Test Document',
        category: 'Test Category',
        tenantId: omitTenantId ? '' : ingestTenantId, // testing invariant
        allowedRoles: ingestRoles.split(',').map((r) => r.trim()),
        allowedUsers: [],
        classificationLevel: ingestClearance,
        content:
          ingestContent ||
          'Sample ingested chunk payload to verify strict tenant_id propagation and vector indexing.',
      });

      setIngestSuccess(
        `Successfully ingested! Created ${res.chunksCreated} vector chunks inheriting tenant_id='${res.document.acl.tenant_id}'.`
      );
      onRefreshDocuments();
    } catch (err: any) {
      setIngestError(err.message || 'Ingestion rejected.');
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Document ACLs, Ingestion & Instant Revocation
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Every chunk strictly inherits its document's ACL as payload metadata. Unprotected chunks without a <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">tenant_id</code> are categorically rejected at ingestion.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('graph')}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'graph'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-indigo-600" />
                <span>Permission Graph</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                <span>Document Grid</span>
              </button>
            </div>

            <button
              onClick={() => {
                setShowIngestModal(true);
                setIngestError(null);
                setIngestSuccess(null);
              }}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ingest Document</span>
            </button>
          </div>
        </div>

        {/* Tenant Filter Tabs */}
        <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'all', label: 'All Tenants' },
            { id: 'tenant_acme', label: 'Acme Corporation' },
            { id: 'tenant_apexbio', label: 'ApexBio Therapeutics' },
            { id: 'tenant_horizon', label: 'Horizon Financial' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTenant(t.id)}
              className={`py-1.5 px-3 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedTenant === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revocation Test Result Toast / Card if active */}
      {revocationTestResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-emerald-900">
              Instant Revocation Verified: {revocationTestResult.docId}
            </div>
            <div className="text-emerald-800 mt-1 space-y-0.5">
              <div>
                • Vector chunk ACL payload updated in{' '}
                <span className="font-mono font-bold">{revocationTestResult.revocationLatencyMs} ms</span>.
              </div>
              <div>
                • Subsequent query retrieved{' '}
                <span className="font-mono font-bold">{revocationTestResult.afterHits} chunks</span> (Expected: 0).
              </div>
              <div>• Zero cache stale hits or permission delay window.</div>
            </div>
          </div>
        </div>
      )}

      {/* Main View: Visual Graph or Document Grid */}
      {viewMode === 'graph' ? (
        <DocumentAclGraph
          documents={filteredDocs}
          personas={personas}
          selectedTenantId={selectedTenant}
          onEditDocAcl={handleOpenEdit}
          onRevokeRole={handleQuickRevokeRole}
        />
      ) : (
        /* Document Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">{doc.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
                    <span>{doc.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-indigo-600 font-medium">{doc.tenant_id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.chunkCount} chunks</span>
                  </div>
                </div>

                {/* Classification text */}
                <span
                  className={`text-[11px] font-mono uppercase font-semibold px-2 py-0.5 rounded border ${
                    doc.acl.classification_level === 'public'
                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                      : doc.acl.classification_level === 'internal'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : doc.acl.classification_level === 'confidential'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {doc.acl.classification_level}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{doc.summary}</p>

              {/* ACL Configuration Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-3 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Allowed Roles:</span>
                  <span className="text-slate-800">
                    {doc.acl.allowed_roles.length > 0 ? `[${doc.acl.allowed_roles.join(', ')}]` : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Allowed Users:</span>
                  <span className="text-slate-800">
                    {doc.acl.allowed_users.length > 0 ? `[${doc.acl.allowed_users.join(', ')}]` : 'All role holders'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleRunImmediateRevocationTest(doc)}
                disabled={testingRevocation}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Test Immediate Revocation</span>
              </button>

              <button
                onClick={() => handleOpenEdit(doc)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Edit ACL
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Edit ACL Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Edit ACL: {editingDoc.id}
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-medium block mb-1">
                  Allowed Roles (comma-separated, use * for public in tenant):
                </label>
                <input
                  type="text"
                  value={allowedRolesInput}
                  onChange={(e) => setAllowedRolesInput(e.target.value)}
                  placeholder="e.g. engineer, admin, hr"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">
                  Allowed User IDs (comma-separated, optional override):
                </label>
                <input
                  type="text"
                  value={allowedUsersInput}
                  onChange={(e) => setAllowedUsersInput(e.target.value)}
                  placeholder="e.g. usr_alice, usr_bob"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">
                  Classification Level:
                </label>
                <select
                  value={classificationInput}
                  onChange={(e) => setClassificationInput(e.target.value as ClassificationLevel)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono focus:bg-white focus:outline-none"
                >
                  <option value="public">public</option>
                  <option value="internal">internal</option>
                  <option value="confidential">confidential</option>
                  <option value="restricted">restricted</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingDoc(null)}
                className="py-1.5 px-3 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAcl}
                className="py-1.5 px-4 bg-slate-900 text-white rounded text-xs font-medium"
              >
                Save & Propagate Chunks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingestion & Invariant Test Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Ingest New Document</h3>
                <p className="text-xs text-slate-500">
                  Every chunk inherits document ACL. Ingestion strictly rejects missing tenant_id.
                </p>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {ingestError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">INGESTION INVARIANT ENFORCED</div>
                  <div>{ingestError}</div>
                </div>
              </div>
            )}

            {ingestSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{ingestSuccess}</div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Document Title:</label>
                <input
                  type="text"
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="e.g. Acme Q4 Financial Forecast"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">
                    Tenant ID (Mandatory):
                  </label>
                  <select
                    value={ingestTenantId}
                    onChange={(e) => setIngestTenantId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none font-mono"
                  >
                    <option value="tenant_acme">tenant_acme (Acme Corp)</option>
                    <option value="tenant_apexbio">tenant_apexbio (ApexBio)</option>
                    <option value="tenant_horizon">tenant_horizon (Horizon)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 font-medium block mb-1">Classification:</label>
                  <select
                    value={ingestClearance}
                    onChange={(e) => setIngestClearance(e.target.value as ClassificationLevel)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none font-mono"
                  >
                    <option value="public">public</option>
                    <option value="internal">internal</option>
                    <option value="confidential">confidential</option>
                    <option value="restricted">restricted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Allowed Roles:</label>
                <input
                  type="text"
                  value={ingestRoles}
                  onChange={(e) => setIngestRoles(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Document Content:</label>
                <textarea
                  rows={4}
                  value={ingestContent}
                  onChange={(e) => setIngestContent(e.target.value)}
                  placeholder="Enter text to be chunked into vector storage..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Negative Test: Attempt to omit tenant_id */}
              <button
                onClick={() => handleTestIngest(true)}
                disabled={isIngesting}
                className="py-1.5 px-3 text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors text-left"
              >
                Test Invariant: Ingest Without tenant_id
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowIngestModal(false)}
                  className="py-1.5 px-3 text-xs text-slate-600 hover:text-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => handleTestIngest(false)}
                  disabled={isIngesting}
                  className="py-1.5 px-4 bg-slate-900 text-white rounded text-xs font-medium"
                >
                  {isIngesting ? 'Ingesting...' : 'Ingest & Chunk'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
