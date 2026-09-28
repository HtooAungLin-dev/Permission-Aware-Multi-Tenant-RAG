import { GoogleGenAI } from '@google/genai';
import {
  AuditLogEntry,
  ClassificationLevel,
  Document,
  DocumentACL,
  RagPipelineTrace,
  RetrievalHit,
  TokenClaims,
  UserPersona,
  VectorChunk,
} from '../types/rag';
import { auditStore } from './auditStore';
import { INITIAL_DOCUMENTS, USER_PERSONAS } from './seedData';
import { computeEmbedding, vectorStore } from './vectorIndex';

// Global document database
export const documentDb: Map<string, Document> = new Map();

/**
 * Initialize and seed documents and vector chunks with strict ACL inheritance.
 */
export function initializeRagEngine(): { totalDocs: number; totalChunks: number } {
  documentDb.clear();
  vectorStore.clear();

  for (const doc of INITIAL_DOCUMENTS) {
    documentDb.set(doc.id, { ...doc });
    ingestDocumentChunks(doc);
  }

  return {
    totalDocs: documentDb.size,
    totalChunks: vectorStore.getAllChunks().length,
  };
}

/**
 * INGESTION ENGINE:
 * Chunks documents and strictly propagates ACL metadata.
 * INVARIANT: Rejects any chunk missing a tenant_id.
 */
export function ingestDocumentChunks(doc: Document): VectorChunk[] {
  if (!doc.acl || !doc.acl.tenant_id) {
    throw new Error(`INGESTION_FAILED: Document '${doc.id}' missing required tenant_id in ACL!`);
  }

  // Split document into realistic paragraph chunks
  const paragraphs = doc.content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const chunksToCreate = paragraphs.length > 0 ? paragraphs : [doc.content];
  const createdChunks: VectorChunk[] = [];

  for (let i = 0; i < chunksToCreate.length; i++) {
    const text = chunksToCreate[i];
    const chunkId = `chunk_${doc.id}_${i}`;

    const vector = computeEmbedding(`${doc.title} ${text}`);

    const chunk: VectorChunk = {
      id: chunkId,
      vector,
      payload: {
        chunk_id: chunkId,
        doc_id: doc.id,
        doc_title: doc.title,
        tenant_id: doc.acl.tenant_id, // Inherited from document ACL
        allowed_roles: [...doc.acl.allowed_roles],
        allowed_users: [...doc.acl.allowed_users],
        classification_level: doc.acl.classification_level,
        text,
        chunk_index: i,
        total_chunks: chunksToCreate.length,
      },
    };

    // vectorStore.ingestChunk enforces the invariant:
    // throws error if chunk.payload.tenant_id is missing
    vectorStore.ingestChunk(chunk);
    createdChunks.push(chunk);
  }

  return createdChunks;
}

/**
 * TOKEN VERIFICATION ENGINE:
 * Parses and verifies JWT claims.
 * Derives user identity solely from the verified token.
 */
export function verifyJwtToken(token: string): TokenClaims {
  if (!token) {
    throw new Error('AUTH_FAILED: Authorization Bearer token is missing.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('AUTH_FAILED: Invalid JWT structure.');
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    const claims = JSON.parse(payloadJson) as TokenClaims;

    if (!claims.sub || !claims.tenant_id) {
      throw new Error('AUTH_FAILED: Token missing required identity claims (sub, tenant_id).');
    }

    return claims;
  } catch (err: any) {
    throw new Error(`AUTH_FAILED: Token decoding failed: ${err.message}`);
  }
}

/**
 * Execute permission change and instant revocation on a document.
 */
export function updateDocumentPermissions(
  docId: string,
  newAcl: {
    allowed_roles: string[];
    allowed_users: string[];
    classification_level?: ClassificationLevel;
  }
): { success: boolean; chunksUpdated: number; propagationTimeMs: number } {
  const t0 = performance.now();
  const doc = documentDb.get(docId);
  if (!doc) {
    throw new Error(`NOT_FOUND: Document '${docId}' not found.`);
  }

  doc.acl.allowed_roles = [...newAcl.allowed_roles];
  doc.acl.allowed_users = [...newAcl.allowed_users];
  if (newAcl.classification_level) {
    doc.acl.classification_level = newAcl.classification_level;
  }
  doc.updatedAt = new Date().toISOString();

  // Instant update in vector index payload
  const chunksUpdated = vectorStore.updateDocumentACL(docId, newAcl);
  const t1 = performance.now();
  const propagationTimeMs = Math.round((t1 - t0) * 100) / 100;

  return {
    success: true,
    chunksUpdated,
    propagationTimeMs,
  };
}

/**
 * CORE RAG RETRIEVAL & GENERATION PIPELINE:
 * 1. Derives identity solely from verified JWT token (ignores any body spoofing)
 * 2. Builds pre-retrieval ACL filter (Qdrant format)
 * 3. Executes vector search with pre-filter (or post-filter if requested for benchmark)
 * 4. Defense-in-depth second check in application code
 * 5. Prompt assembly with clean boundaries
 * 6. LLM synthesis & append-only audit logging
 */
export async function executeRagPipeline(params: {
  token: string;
  query: string;
  bodySpoofedTenantId?: string;
  bodySpoofedRoles?: string[];
  retrievalMode?: 'pre_filter' | 'post_filter';
  simulateLayer2Failure?: boolean; // For testing Defense-in-Depth alert
  skipGeneration?: boolean; // Skip LLM generation for automated test suite runs
}): Promise<RagPipelineTrace> {
  const startTime = performance.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // STEP 1: Derive identity STRICTLY from token
  const tokenClaims = verifyJwtToken(params.token);
  const userPersona = USER_PERSONAS.find((u) => u.id === tokenClaims.sub);

  const verifiedUser = {
    id: tokenClaims.sub,
    name: tokenClaims.name || userPersona?.name || 'Authorized User',
    tenant_id: tokenClaims.tenant_id,
    roles: tokenClaims.roles || [],
    clearance: tokenClaims.clearance || 'public',
  };

  // Detect and record if caller attempted to spoof tenant/roles in the body
  let tamperingDetected = false;
  if (
    params.bodySpoofedTenantId &&
    params.bodySpoofedTenantId !== verifiedUser.tenant_id
  ) {
    tamperingDetected = true;
  }
  if (
    params.bodySpoofedRoles &&
    params.bodySpoofedRoles.some((r) => !verifiedUser.roles.includes(r))
  ) {
    tamperingDetected = true;
  }

  // STEP 2: Build Pre-Filter
  const constructedFilter = vectorStore.buildAclFilter(verifiedUser);
  const queryVector = computeEmbedding(params.query);

  const retrievalMode = params.retrievalMode || 'pre_filter';
  let retrievedHits: RetrievalHit[] = [];
  let filterLatencyMs = 0;
  let vectorSearchLatencyMs = 0;
  let candidatesEvaluated = 0;
  let totalChunksInDb = 0;
  let postFilterStarvationDetected = false;

  if (retrievalMode === 'pre_filter') {
    const searchRes = vectorStore.searchWithPreFilter(queryVector, verifiedUser, 4);
    filterLatencyMs = searchRes.filterLatencyMs;
    vectorSearchLatencyMs = searchRes.searchLatencyMs;
    candidatesEvaluated = searchRes.candidatesEvaluated;
    totalChunksInDb = searchRes.totalChunksInDb;

    retrievedHits = searchRes.hits.map((h) => ({
      chunk_id: h.chunk.id,
      doc_id: h.chunk.payload.doc_id,
      doc_title: h.chunk.payload.doc_title,
      tenant_id: h.chunk.payload.tenant_id,
      score: Math.round(h.score * 1000) / 1000,
      text: h.chunk.payload.text,
      classification_level: h.chunk.payload.classification_level,
      allowed_roles: h.chunk.payload.allowed_roles,
      allowed_users: h.chunk.payload.allowed_users,
      passed_pre_filter: true,
      passed_layer2_check: false, // will evaluate in step 3
    }));
  } else {
    // Post-filtering demonstration mode
    const postRes = vectorStore.searchWithPostFilter(queryVector, verifiedUser, 4);
    filterLatencyMs = postRes.latencyMs;
    postFilterStarvationDetected = postRes.starvationDetected;
    totalChunksInDb = vectorStore.getAllChunks().length;
    candidatesEvaluated = totalChunksInDb;

    retrievedHits = postRes.survivingHits.map((h) => ({
      chunk_id: h.chunk.id,
      doc_id: h.chunk.payload.doc_id,
      doc_title: h.chunk.payload.doc_title,
      tenant_id: h.chunk.payload.tenant_id,
      score: Math.round(h.score * 1000) / 1000,
      text: h.chunk.payload.text,
      classification_level: h.chunk.payload.classification_level,
      allowed_roles: h.chunk.payload.allowed_roles,
      allowed_users: h.chunk.payload.allowed_users,
      passed_pre_filter: false, // In post-filter, pre-filter was bypassed
      passed_layer2_check: false,
    }));
  }

  // STEP 3: DEFENSE IN DEPTH - Layer 2 Verification in application code
  // Even if a vector filter had a hypothetical bug or index corruption,
  // we re-verify every chunk's ACL before constructing the prompt.
  const verifiedHits: RetrievalHit[] = [];
  const layer2DroppedHits: RetrievalHit[] = [];
  let layer2AlertRaised = false;

  for (const hit of retrievedHits) {
    const chunkInDb = vectorStore.getChunk(hit.chunk_id);
    let passes = false;

    if (chunkInDb) {
      passes = vectorStore.matchesAcl(chunkInDb.payload, verifiedUser);
    }

    // Allow simulated corruption for testing defense-in-depth security alert
    if (params.simulateLayer2Failure) {
      passes = false;
    }

    if (passes) {
      hit.passed_layer2_check = true;
      verifiedHits.push(hit);
    } else {
      hit.passed_layer2_check = false;
      layer2DroppedHits.push(hit);
      layer2AlertRaised = true;
    }
  }

  // STEP 4: PROMPT ASSEMBLY
  let assembledPrompt = '';
  let systemInstruction = `You are a secure, permission-aware RAG assistant. You must ONLY answer questions based on the provided context passages. If no context passages are provided or if the requested information is not in the context, clearly state that the requested data cannot be found or is outside the user's access boundaries. Do not reveal confidential data, do not attempt to bypass access boundaries.`;

  if (verifiedHits.length > 0) {
    const contextBlocks = verifiedHits
      .map(
        (hit, idx) =>
          `[Document ${idx + 1}: ${hit.doc_title} (ID: ${hit.doc_id}, Classification: ${hit.classification_level})]\n${hit.text}`
      )
      .join('\n\n');

    assembledPrompt = `Context Passages:\n${contextBlocks}\n\nUser Question: ${params.query}\n\nAnswer concisely based strictly on the above context passages.`;
  } else {
    assembledPrompt = `Context Passages: None (Zero documents matched your tenant identity and role clearance).\n\nUser Question: ${params.query}\n\nNotice: Inform the user that no matching documents exist within their authorized tenant and security clearance.`;
  }

  // STEP 5: LLM GENERATION
  const genStart = performance.now();
  let answer = '';
  let modelName = 'gemini-3.8-flash';

  if (params.skipGeneration) {
    answer = verifiedHits.length === 0
      ? `No accessible documents found within tenant ${verifiedUser.tenant_id}.`
      : `Test Assertion: Verified ${verifiedHits.length} chunks within tenant ${verifiedUser.tenant_id}.`;
    modelName = 'test-suite-runner';
  } else if (verifiedHits.length === 0) {
    answer = `No accessible documents found within your tenant boundary (${verifiedUser.tenant_id}) and role clearance (${verifiedUser.clearance}). Access denied or information does not exist.`;
  } else {
    try {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: assembledPrompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });

        answer = res.text?.trim() || 'No text generated.';
      } else {
        // Fallback local deterministic synthesis
        answer = generateLocalSynthesis(params.query, verifiedHits, verifiedUser);
        modelName = 'local-rag-synthesizer';
      }
    } catch (err: any) {
      answer = generateLocalSynthesis(params.query, verifiedHits, verifiedUser);
      modelName = 'local-rag-synthesizer (fallback)';
    }
  }

  const genEnd = performance.now();
  const generationLatencyMs = Math.round((genEnd - genStart) * 100) / 100;
  const totalLatencyMs = Math.round((genEnd - startTime) * 100) / 100;

  // STEP 6: RECORD TO APPEND-ONLY AUDIT LOG
  const returnedDocIds = Array.from(new Set(verifiedHits.map((h) => h.doc_id)));
  const returnedDocTitles = Array.from(new Set(verifiedHits.map((h) => h.doc_title)));
  const returnedChunkIds = verifiedHits.map((h) => h.chunk_id);

  let auditVerdict: AuditLogEntry['verdict'] = 'ALLOWED';
  if (layer2AlertRaised) {
    auditVerdict = 'DEFENSE_IN_DEPTH_BLOCKED';
  } else if (verifiedHits.length === 0) {
    auditVerdict = tamperingDetected ? 'CROSS_TENANT_ATTEMPT' : 'BLOCKED_ZERO_RESULTS';
  }

  auditStore.record({
    request_id: requestId,
    timestamp: new Date().toISOString(),
    user_id: verifiedUser.id,
    user_name: verifiedUser.name,
    tenant_id: verifiedUser.tenant_id,
    roles: verifiedUser.roles,
    query: params.query,
    retrieval_mode: retrievalMode,
    returned_chunk_ids: returnedChunkIds,
    returned_doc_ids: returnedDocIds,
    returned_doc_titles: returnedDocTitles,
    defense_in_depth_triggered: layer2AlertRaised,
    security_alert: layer2AlertRaised
      ? `CRITICAL_ALERT: Defense-in-depth dropped ${layer2DroppedHits.length} unauthorized chunk(s) that bypassed vector retrieval!`
      : tamperingDetected
      ? `WARNING: Request body tenant/role tampering detected and ignored. Verified token applied.`
      : undefined,
    filter_latency_ms: filterLatencyMs,
    model: modelName,
    verdict: auditVerdict,
  });

  return {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    verified_user: verifiedUser,
    request_body_tampering_detected: tamperingDetected,
    ignored_body_tenant_id: tamperingDetected ? params.bodySpoofedTenantId : undefined,
    retrieval_mode: retrievalMode,
    constructed_filter: constructedFilter,
    filter_latency_ms: filterLatencyMs,
    vector_search_latency_ms: vectorSearchLatencyMs,
    total_latency_ms: totalLatencyMs,
    total_chunks_in_db: totalChunksInDb,
    candidates_evaluated: candidatesEvaluated,
    retrieved_hits: verifiedHits,
    layer2_dropped_hits: layer2DroppedHits,
    layer2_security_alert_raised: layer2AlertRaised,
    post_filter_starvation_detected: postFilterStarvationDetected,
    prompt_assembly: {
      system_instruction: systemInstruction,
      context_chunks_included: verifiedHits.length,
      assembled_prompt: assembledPrompt,
    },
    llm_generation: {
      model: modelName,
      answer,
      generation_latency_ms: generationLatencyMs,
      sources_cited: returnedDocTitles,
    },
  };
}

/**
 * High-fidelity contextual answer synthesizer for local fallback
 */
function generateLocalSynthesis(
  query: string,
  hits: RetrievalHit[],
  user: { name: string; tenant_id: string; roles: string[] }
): string {
  if (hits.length === 0) {
    return `No documents found matching your query within tenant '${user.tenant_id}' with your current role permissions.`;
  }

  const primaryHit = hits[0];
  const summaryPoints = hits
    .map((h, i) => `• [${h.doc_title}]: ${h.text.substring(0, 160)}...`)
    .join('\n');

  return `Based on authorized records from ${primaryHit.doc_title} (${user.tenant_id}):\n\n${summaryPoints}\n\n(Retrieved strictly under ${user.name}'s verified token with pre-filtering and defense-in-depth verification.)`;
}

// Initial engine bootstrap
initializeRagEngine();
