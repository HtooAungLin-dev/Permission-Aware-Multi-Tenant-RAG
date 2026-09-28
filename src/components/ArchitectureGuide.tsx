import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Database,
  Layers,
  FileCheck2,
  Lock,
  Code2,
  Cpu,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-base font-semibold text-slate-900">
          Permission-Aware Multi-Tenant RAG Architecture
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
          In multi-tenant AI systems, standard RAG poses severe data breach risks. When sensitive documents (e.g. executive salaries, clinical trial patient curves, trading algorithms) exist in the same vector space, naive vector search will happily retrieve them for prompt injection attacks or unauthorized personas. Here is the verified 5-pillar security pattern.
        </p>
      </div>

      {/* Comparison: Pre-Filtering vs Post-Filtering */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Post-filtering (Vulnerable) */}
        <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              ✕
            </span>
            <h3 className="text-sm font-semibold text-rose-900">
              Anti-Pattern: Post-Filtering (Retrieve Top-K, Then Drop)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The vector database queries top-K globally across all tenants. Then, application code drops chunks the user lacks permissions for.
          </p>
          <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-xs text-rose-900 space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Critical Vulnerabilities:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800">
              <li>
                <strong>Top-K Starvation:</strong> If a query strongly matches forbidden documents, all K slots are filled by forbidden chunks. After dropping them, the user is left with 0 results even though valid documents exist!
              </li>
              <li>
                <strong>Side-Channel Leakage:</strong> An attacker can deduce the existence, topic, or volume of confidential documents by observing result count gaps or latency spikes.
              </li>
            </ul>
          </div>
        </div>

        {/* Pre-filtering (Secure) */}
        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              ✓
            </span>
            <h3 className="text-sm font-semibold text-emerald-900">
              Gold Standard: Pre-Filtering (Qdrant / pgvector RLS)
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The ACL filter is applied directly inside the vector search index before computing cosine distances or ranking.
          </p>
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-xs text-emerald-900 space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Security Guarantees:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-800">
              <li>
                <strong>Zero Cross-Tenant Candidates:</strong> Forbidden chunks are never evaluated; candidates outside <code className="font-mono">tenant_id</code> cannot enter the scoring pipeline.
              </li>
              <li>
                <strong>No Starvation:</strong> Top-K candidates are filled exclusively from authorized documents.
              </li>
              <li>
                <strong>Sub-millisecond Overhead:</strong> Payload indexing on <code className="font-mono">tenant_id</code> and <code className="font-mono">allowed_roles</code> ensures filtering takes &lt; 0.5ms.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Code Implementations (Qdrant & Postgres pgvector) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Qdrant Pre-Filter Code */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-600" />
              <span>Qdrant Payload Pre-Filter (Python / FastAPI)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Payload Index Filter</span>
          </div>

          <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-3.5 rounded-lg overflow-x-auto leading-relaxed">
{`from qdrant_client import models

def acl_filter(verified_token_user) -> models.Filter:
    # 1. Identity derived SOLELY from verified JWT
    # 2. Never trust tenant_id from request body
    return models.Filter(
        must=[
            models.FieldCondition(
                key="tenant_id",
                match=models.MatchValue(value=verified_token_user.tenant_id)
            )
        ],
        should=[
            models.FieldCondition(
                key="allowed_roles",
                match=models.MatchAny(any=verified_token_user.roles)
            ),
            models.FieldCondition(
                key="allowed_users",
                match=models.MatchValue(value=verified_token_user.id)
            ),
        ],
    )

hits = client.query_points(
    "chunks",
    query=query_vector,
    query_filter=acl_filter(verified_user),
    limit=10
)`}
          </pre>
        </div>

        {/* Postgres pgvector RLS */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Postgres + pgvector Row-Level Security (RLS)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Database Engine Isolation</span>
          </div>

          <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-3.5 rounded-lg overflow-x-auto leading-relaxed">
{`-- Enable Row Level Security on the chunks table
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Enforce strict tenant boundary before vector KNN
CREATE POLICY tenant_isolation_policy ON document_chunks
FOR SELECT
USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    allowed_roles && string_to_array(current_setting('app.current_user_roles'), ',')
    OR current_setting('app.current_user_id') = ANY(allowed_users)
  )
);

-- Query execution (RLS runs automatically on vector index)
SELECT chunk_id, text, 1 - (embedding <=> q_vec) as similarity
FROM document_chunks
ORDER BY embedding <=> q_vec
LIMIT 10;`}
          </pre>
        </div>
      </div>

      {/* The 5 Non-Negotiable Invariants */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          The 5 Non-Negotiable Invariants of Permission-Aware RAG
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              1. Token-Only Identity
            </span>
            <p className="text-slate-600 text-[11px]">
              The server extracts <code className="font-mono">tenant_id</code> and <code className="font-mono">roles</code> exclusively from the verified JWT. Any tenant or role passed in the request body is discarded.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              2. Strict Ingestion Invariant
            </span>
            <p className="text-slate-600 text-[11px]">
              Every chunk inherits its document's ACL. Ingestion rejects any chunk missing a <code className="font-mono">tenant_id</code>, guaranteeing an unprotected chunk can never exist in vector storage.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              3. Defense-in-Depth Layer 2
            </span>
            <p className="text-slate-600 text-[11px]">
              Even after vector pre-filtering, application code re-verifies every candidate chunk's ACL against user clearance before assembling the prompt. If anything fails, it is dropped and an alert is raised.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              4. Instant Revocation
            </span>
            <p className="text-slate-600 text-[11px]">
              When permissions change, chunk payloads are updated by document ID. The subsequent query can no longer retrieve the document (&lt; 5ms propagation).
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              5. Append-Only Audit Trail
            </span>
            <p className="text-slate-600 text-[11px]">
              Every retrieval records request ID, user, tenant, query, returned chunk IDs, and latency in an immutable audit ledger, powering answers to "Who retrieved doc X in the last 30 days".
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              6. CI Adversarial Suite
            </span>
            <p className="text-slate-600 text-[11px]">
              Adversarial queries and prompt injections run automatically in CI, asserting zero cross-tenant chunk leakage across all personas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 13l4 4L19 7"
      ></path>
    </svg>
  );
}
