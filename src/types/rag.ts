/**
 * Permission-Aware Multi-Tenant RAG Data Models & Schemas
 */

export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export interface DocumentACL {
  tenant_id: string;
  allowed_roles: string[];
  allowed_users: string[];
  classification_level: ClassificationLevel;
}

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  tenant_id: string;
  tenant_name: string;
  roles: string[];
  classification_clearance: ClassificationLevel;
  avatar: string;
  description: string;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  tenant_id: string;
  tenant_name: string;
  acl: DocumentACL;
  summary: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface ChunkPayload {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  tenant_id: string;
  allowed_roles: string[];
  allowed_users: string[];
  classification_level: ClassificationLevel;
  text: string;
  chunk_index: number;
  total_chunks: number;
}

export interface VectorChunk {
  id: string;
  vector: number[];
  payload: ChunkPayload;
}

export interface TokenClaims {
  sub: string;
  name: string;
  tenant_id: string;
  roles: string[];
  clearance: ClassificationLevel;
  iat: number;
  exp: number;
  jti: string;
}

export interface QdrantPayloadFilter {
  must: Array<{
    key: string;
    match: { value: string };
  }>;
  should: Array<{
    key: string;
    match: { any?: string[]; value?: string };
  }>;
}

export interface RetrievalHit {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  tenant_id: string;
  score: number;
  text: string;
  classification_level: ClassificationLevel;
  allowed_roles: string[];
  allowed_users: string[];
  passed_pre_filter: boolean;
  passed_layer2_check: boolean;
}

export interface RagPipelineTrace {
  request_id: string;
  timestamp: string;
  verified_user: {
    id: string;
    name: string;
    tenant_id: string;
    roles: string[];
    clearance: ClassificationLevel;
  };
  request_body_tampering_detected?: boolean;
  ignored_body_tenant_id?: string;
  retrieval_mode: 'pre_filter' | 'post_filter';
  constructed_filter: QdrantPayloadFilter;
  filter_latency_ms: number;
  vector_search_latency_ms: number;
  total_latency_ms: number;
  total_chunks_in_db: number;
  candidates_evaluated: number;
  retrieved_hits: RetrievalHit[];
  layer2_dropped_hits: RetrievalHit[];
  layer2_security_alert_raised: boolean;
  post_filter_starvation_detected?: boolean;
  prompt_assembly: {
    system_instruction: string;
    context_chunks_included: number;
    assembled_prompt: string;
  };
  llm_generation: {
    model: string;
    answer: string;
    generation_latency_ms: number;
    sources_cited: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  request_id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  tenant_id: string;
  roles: string[];
  query: string;
  retrieval_mode: 'pre_filter' | 'post_filter';
  returned_chunk_ids: string[];
  returned_doc_ids: string[];
  returned_doc_titles: string[];
  defense_in_depth_triggered: boolean;
  security_alert?: string;
  filter_latency_ms: number;
  model: string;
  verdict: 'ALLOWED' | 'BLOCKED_ZERO_RESULTS' | 'DEFENSE_IN_DEPTH_BLOCKED' | 'CROSS_TENANT_ATTEMPT';
}

export interface LeakageTestCase {
  id: string;
  name: string;
  category: 'cross_tenant' | 'privilege_escalation' | 'token_spoofing' | 'prompt_injection' | 'revocation' | 'ingestion_invariant';
  description: string;
  user_persona: UserPersona;
  query: string;
  body_spoof_tenant?: string;
  body_spoof_roles?: string[];
  expected_verdict: 'PASS' | 'FAIL';
  forbidden_doc_ids: string[];
  forbidden_keywords: string[];
  explanation: string;
}

export interface LeakageTestResult {
  test_id: string;
  test_name: string;
  category: string;
  user_name: string;
  tenant_id: string;
  query: string;
  status: 'PASSED' | 'FAILED';
  leaked_chunks_count: number;
  leaked_doc_ids: string[];
  retrieved_chunk_ids: string[];
  latency_ms: number;
  reason: string;
  trace_id: string;
}

export interface LeakageSuiteSummary {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  cross_tenant_leaks: number;
  avg_pre_filter_overhead_ms: number;
  avg_post_filter_overhead_ms: number;
  permission_revocation_delay_ms: number;
  results: LeakageTestResult[];
  executed_at: string;
}
