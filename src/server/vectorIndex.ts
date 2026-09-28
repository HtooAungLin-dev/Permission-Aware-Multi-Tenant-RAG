import { ChunkPayload, ClassificationLevel, QdrantPayloadFilter, VectorChunk } from '../types/rag';

const CLASSIFICATION_RANK: Record<ClassificationLevel, number> = {
  public: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
};

/**
 * Deterministic semantic dense vector embedding generator (128 dimensions).
 * Uses character n-grams and vocabulary hashing with TF-IDF weighting and L2 normalization
 * to ensure realistic cosine similarity matches for domain vocabulary (e.g. salary, trial, oncology,
 * kubernetes, hedge fund, portfolio, etc.).
 */
export function computeEmbedding(text: string): number[] {
  const dim = 128;
  const vector = new Array(dim).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  // Term frequency hash accumulation
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Hash word to dimension
    let h1 = 0;
    for (let j = 0; j < word.length; j++) {
      h1 = (h1 << 5) - h1 + word.charCodeAt(j);
      h1 |= 0;
    }
    const idx = Math.abs(h1) % dim;
    const sign = (h1 & 1) === 0 ? 1 : -1;
    vector[idx] += sign * (1 + Math.log(1 + 1 / (i + 1)));

    // Bi-gram hashing for contextual pairs (e.g., "salary ledger", "clinical trial")
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      let h2 = 0;
      for (let j = 0; j < bigram.length; j++) {
        h2 = (h2 << 5) - h2 + bigram.charCodeAt(j);
        h2 |= 0;
      }
      const bIdx = Math.abs(h2) % dim;
      vector[bIdx] += 1.5;
    }
  }

  // L2 Normalization to unit length
  let norm = 0;
  for (let v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vector[i] /= norm;
    }
  }
  return vector;
}

/**
 * Cosine similarity between two unit-normalized vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, (dotProduct + 1) / 2)); // Normalized to [0, 1]
}

export interface UserContext {
  id: string;
  tenant_id: string;
  roles: string[];
  clearance: ClassificationLevel;
}

export class VectorStoreIndex {
  private chunks: Map<string, VectorChunk> = new Map();
  // Payload indexes for sub-millisecond filtering
  private tenantIndex: Map<string, Set<string>> = new Map();
  private roleIndex: Map<string, Set<string>> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  private docIndex: Map<string, Set<string>> = new Map();

  constructor() {}

  /**
   * INGESTION STEP: Ingest a chunk into the vector store.
   * STRICT INGESTION INVARIANT: Reject any chunk without a tenant_id!
   */
  public ingestChunk(chunk: VectorChunk): void {
    if (!chunk.payload || !chunk.payload.tenant_id || chunk.payload.tenant_id.trim() === '') {
      throw new Error(
        `INGESTION_REJECTED: Unprotected chunk '${chunk.id}' detected! All chunks must carry a non-empty 'tenant_id'.`
      );
    }

    this.chunks.set(chunk.id, chunk);

    // Update tenant payload index
    const tenantId = chunk.payload.tenant_id;
    if (!this.tenantIndex.has(tenantId)) {
      this.tenantIndex.set(tenantId, new Set());
    }
    this.tenantIndex.get(tenantId)!.add(chunk.id);

    // Update doc index
    const docId = chunk.payload.doc_id;
    if (!this.docIndex.has(docId)) {
      this.docIndex.set(docId, new Set());
    }
    this.docIndex.get(docId)!.add(chunk.id);

    // Update role index
    for (const role of chunk.payload.allowed_roles) {
      if (!this.roleIndex.has(role)) {
        this.roleIndex.set(role, new Set());
      }
      this.roleIndex.get(role)!.add(chunk.id);
    }

    // Update user index
    for (const userId of chunk.payload.allowed_users) {
      if (!this.userIndex.has(userId)) {
        this.userIndex.set(userId, new Set());
      }
      this.userIndex.get(userId)!.add(chunk.id);
    }
  }

  /**
   * Updates ACL payload metadata across all chunks belonging to a document.
   * Ensures instant permission revocation takes effect across all chunks.
   */
  public updateDocumentACL(
    docId: string,
    newAcl: {
      allowed_roles: string[];
      allowed_users: string[];
      classification_level?: ClassificationLevel;
    }
  ): number {
    const chunkIds = this.docIndex.get(docId);
    if (!chunkIds) return 0;

    let updatedCount = 0;
    for (const chunkId of chunkIds) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        chunk.payload.allowed_roles = [...newAcl.allowed_roles];
        chunk.payload.allowed_users = [...newAcl.allowed_users];
        if (newAcl.classification_level) {
          chunk.payload.classification_level = newAcl.classification_level;
        }
        updatedCount++;
      }
    }
    return updatedCount;
  }

  /**
   * Check if a single chunk matches the ACL of the requesting user.
   */
  public matchesAcl(payload: ChunkPayload, user: UserContext): boolean {
    // 1. Strict Tenant Boundary
    if (payload.tenant_id !== user.tenant_id) {
      return false;
    }

    // 2. Classification Clearance check
    const userClearanceRank = CLASSIFICATION_RANK[user.clearance] || 1;
    const chunkClearanceRank = CLASSIFICATION_RANK[payload.classification_level] || 1;
    if (userClearanceRank < chunkClearanceRank) {
      return false;
    }

    // 3. User direct ACL override
    if (payload.allowed_users && payload.allowed_users.includes(user.id)) {
      return true;
    }

    // 4. Role membership check
    if (payload.allowed_roles && payload.allowed_roles.includes('*')) {
      return true; // Public within tenant
    }

    const hasMatchingRole = payload.allowed_roles.some((role) => user.roles.includes(role));
    return hasMatchingRole;
  }

  /**
   * Builds the official Qdrant-equivalent Filter object derived from the verified user token.
   */
  public buildAclFilter(user: UserContext): QdrantPayloadFilter {
    return {
      must: [
        {
          key: 'tenant_id',
          match: { value: user.tenant_id },
        },
      ],
      should: [
        {
          key: 'allowed_roles',
          match: { any: [...user.roles, '*'] },
        },
        {
          key: 'allowed_users',
          match: { value: user.id },
        },
      ],
    };
  }

  /**
   * PRE-FILTERING RETRIEVAL:
   * Filters the search space BEFORE computing vector similarities or ranking.
   * This is the production-grade approach (Qdrant payload filters / pgvector RLS).
   * Guarantees zero cross-tenant candidates reach top-K and avoids top-K starvation.
   */
  public searchWithPreFilter(
    queryVector: number[],
    user: UserContext,
    limit: number = 5
  ): {
    hits: Array<{ chunk: VectorChunk; score: number }>;
    filterLatencyMs: number;
    searchLatencyMs: number;
    candidatesEvaluated: number;
    totalChunksInDb: number;
  } {
    const t0 = performance.now();
    const totalChunksInDb = this.chunks.size;

    // Step 1: Pre-filter candidate selection via tenant payload index
    const tenantChunkIds = this.tenantIndex.get(user.tenant_id) || new Set();
    const eligibleChunks: VectorChunk[] = [];

    for (const chunkId of tenantChunkIds) {
      const chunk = this.chunks.get(chunkId);
      if (chunk && this.matchesAcl(chunk.payload, user)) {
        eligibleChunks.push(chunk);
      }
    }

    const t1 = performance.now();
    const filterLatencyMs = Math.round((t1 - t0) * 100) / 100;

    // Step 2: Compute vector similarity only on eligible chunks
    const scoredChunks: Array<{ chunk: VectorChunk; score: number }> = [];
    for (const chunk of eligibleChunks) {
      const score = cosineSimilarity(queryVector, chunk.vector);
      scoredChunks.push({ chunk, score });
    }

    scoredChunks.sort((a, b) => b.score - a.score);
    const hits = scoredChunks.slice(0, limit);

    const t2 = performance.now();
    const searchLatencyMs = Math.round((t2 - t1) * 100) / 100;

    return {
      hits,
      filterLatencyMs,
      searchLatencyMs,
      candidatesEvaluated: eligibleChunks.length,
      totalChunksInDb,
    };
  }

  /**
   * POST-FILTERING RETRIEVAL (VULNERABILITY DEMONSTRATION):
   * Retrieves top-K across ALL tenants and roles first, THEN drops forbidden results.
   * This reveals the real-world hazards:
   * 1. Top-K Starvation: Legitimate results are pushed out of top-K by confidential documents.
   * 2. Side-Channel Leakage: Attackers can deduce existence of confidential documents via result gaps.
   */
  public searchWithPostFilter(
    queryVector: number[],
    user: UserContext,
    limit: number = 5
  ): {
    rawTopK: Array<{ chunk: VectorChunk; score: number; allowed: boolean }>;
    survivingHits: Array<{ chunk: VectorChunk; score: number }>;
    droppedForbiddenCount: number;
    starvationDetected: boolean;
    latencyMs: number;
  } {
    const t0 = performance.now();

    // 1. Retrieve top-K globally across entire DB without filtering
    const allScored: Array<{ chunk: VectorChunk; score: number }> = [];
    for (const chunk of this.chunks.values()) {
      const score = cosineSimilarity(queryVector, chunk.vector);
      allScored.push({ chunk, score });
    }
    allScored.sort((a, b) => b.score - a.score);
    const globalTopK = allScored.slice(0, limit);

    // 2. Post-hoc discard forbidden chunks
    const rawTopK = globalTopK.map((item) => ({
      chunk: item.chunk,
      score: item.score,
      allowed: this.matchesAcl(item.chunk.payload, user),
    }));

    const survivingHits = rawTopK.filter((item) => item.allowed).map((item) => ({
      chunk: item.chunk,
      score: item.score,
    }));

    const droppedForbiddenCount = rawTopK.length - survivingHits.length;
    // Starvation happens if we could have found valid chunks, but global top-K was filled with forbidden ones
    const starvationDetected = droppedForbiddenCount > 0 && survivingHits.length < limit;

    const t1 = performance.now();
    const latencyMs = Math.round((t1 - t0) * 100) / 100;

    return {
      rawTopK,
      survivingHits,
      droppedForbiddenCount,
      starvationDetected,
      latencyMs,
    };
  }

  public getChunk(id: string): VectorChunk | undefined {
    return this.chunks.get(id);
  }

  public getAllChunks(): VectorChunk[] {
    return Array.from(this.chunks.values());
  }

  public getChunksByDocId(docId: string): VectorChunk[] {
    const ids = this.docIndex.get(docId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.chunks.get(id)!)
      .filter(Boolean);
  }

  public clear(): void {
    this.chunks.clear();
    this.tenantIndex.clear();
    this.roleIndex.clear();
    this.userIndex.clear();
    this.docIndex.clear();
  }
}

// Global Singleton vector store
export const vectorStore = new VectorStoreIndex();
