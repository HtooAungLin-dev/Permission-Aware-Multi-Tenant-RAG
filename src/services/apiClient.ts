import {
  AuditLogEntry,
  Document,
  LeakageSuiteSummary,
  RagPipelineTrace,
  UserPersona,
} from '../types/rag';

export interface PersonaWithToken extends UserPersona {
  jwt_token: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  domain: string;
  industry: string;
  color: string;
}

export const apiClient = {
  async getPersonas(): Promise<{ tenants: TenantInfo[]; personas: PersonaWithToken[] }> {
    const res = await fetch('/api/rag/personas');
    if (!res.ok) {
      throw new Error(`Failed to load personas: ${res.statusText}`);
    }
    return res.json();
  },

  async getDocuments(): Promise<{ documents: Document[] }> {
    const res = await fetch('/api/rag/documents');
    if (!res.ok) {
      throw new Error(`Failed to load documents: ${res.statusText}`);
    }
    return res.json();
  },

  async queryRag(params: {
    token: string;
    query: string;
    bodySpoofedTenantId?: string;
    bodySpoofedRoles?: string[];
    retrievalMode?: 'pre_filter' | 'post_filter';
    simulateLayer2Failure?: boolean;
  }): Promise<RagPipelineTrace> {
    const res = await fetch('/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'RAG query failed');
    }

    return res.json();
  },

  async runTestSuite(): Promise<LeakageSuiteSummary> {
    const res = await fetch('/api/rag/test-suite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to execute leakage test suite');
    }

    return res.json();
  },

  async revokePermissions(params: {
    docId: string;
    allowedRoles: string[];
    allowedUsers: string[];
    classificationLevel?: string;
  }): Promise<{ success: boolean; chunksUpdated: number; propagationTimeMs: number }> {
    const res = await fetch('/api/rag/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Revocation failed');
    }

    return res.json();
  },

  async getAuditLogs(params?: {
    tenantId?: string;
    userId?: string;
    verdict?: string;
    query?: string;
  }): Promise<{ logs: AuditLogEntry[] }> {
    const searchParams = new URLSearchParams();
    if (params?.tenantId) searchParams.append('tenantId', params.tenantId);
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.verdict) searchParams.append('verdict', params.verdict);
    if (params?.query) searchParams.append('query', params.query);

    const res = await fetch(`/api/rag/audit?${searchParams.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load audit logs: ${res.statusText}`);
    }
    return res.json();
  },

  async getDocHistory(
    docId: string,
    days: number = 30
  ): Promise<{
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
  }> {
    const res = await fetch(`/api/rag/audit/doc-history?docId=${encodeURIComponent(docId)}&days=${days}`);
    if (!res.ok) {
      throw new Error(`Failed to get document history: ${res.statusText}`);
    }
    return res.json();
  },

  async ingestDocument(doc: {
    id?: string;
    title: string;
    category: string;
    tenantId: string;
    allowedRoles: string[];
    allowedUsers: string[];
    classificationLevel: string;
    content: string;
    summary?: string;
  }): Promise<{ success: boolean; document: Document; chunksCreated: number }> {
    const res = await fetch('/api/rag/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Document ingestion failed');
    }

    return res.json();
  },
};
