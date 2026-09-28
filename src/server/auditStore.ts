import { AuditLogEntry } from '../types/rag';

/**
 * Append-Only Audit Store for Permission-Aware Multi-Tenant RAG.
 * Records every retrieval transaction with cryptographic request IDs,
 * user identity claims, returned chunk/document IDs, latency, and security alerts.
 */
class AuditStore {
  private logs: AuditLogEntry[] = [];

  constructor() {
    // Seed initial historical audit records to make the 30-day forensic inspection realistic
    this.seedHistoricalLogs();
  }

  public record(entry: Omit<AuditLogEntry, 'id'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
    // Append-only guarantee
    this.logs.unshift(fullEntry);
    return fullEntry;
  }

  public getAll(limit: number = 100): AuditLogEntry[] {
    return this.logs.slice(0, limit);
  }

  /**
   * Admin forensic query: "Who retrieved document X in the last N days?"
   */
  public getRetrievalsForDocument(docId: string, days: number = 30): {
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
  } {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const matchingLogs = this.logs.filter((log) => {
      return (
        log.timestamp >= cutoff &&
        log.returned_doc_ids &&
        log.returned_doc_ids.includes(docId) &&
        (log.verdict === 'ALLOWED' || log.verdict === 'DEFENSE_IN_DEPTH_BLOCKED')
      );
    });

    const userMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        tenantId: string;
        roles: string[];
        lastRetrieved: string;
        accessCount: number;
      }
    >();

    for (const log of matchingLogs) {
      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, {
          userId: log.user_id,
          userName: log.user_name,
          tenantId: log.tenant_id,
          roles: log.roles,
          lastRetrieved: log.timestamp,
          accessCount: 1,
        });
      } else {
        const u = userMap.get(log.user_id)!;
        u.accessCount += 1;
        if (log.timestamp > u.lastRetrieved) {
          u.lastRetrieved = log.timestamp;
        }
      }
    }

    return {
      documentId: docId,
      totalRetrievals: matchingLogs.length,
      uniqueUsers: Array.from(userMap.values()),
      recentLogs: matchingLogs.slice(0, 20),
    };
  }

  public search(params: {
    tenantId?: string;
    userId?: string;
    verdict?: string;
    query?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let result = this.logs;
    if (params.tenantId) {
      result = result.filter((l) => l.tenant_id === params.tenantId);
    }
    if (params.userId) {
      result = result.filter((l) => l.user_id === params.userId);
    }
    if (params.verdict) {
      result = result.filter((l) => l.verdict === params.verdict);
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      result = result.filter(
        (l) =>
          l.query.toLowerCase().includes(q) ||
          l.user_name.toLowerCase().includes(q) ||
          l.request_id.toLowerCase().includes(q)
      );
    }
    return result.slice(0, params.limit || 50);
  }

  private seedHistoricalLogs() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const historical = [
      {
        request_id: 'req_init_9182',
        timestamp: new Date(now - 2 * dayMs).toISOString(),
        user_id: 'usr_charlie',
        user_name: 'Charlie Davis',
        tenant_id: 'tenant_acme',
        roles: ['hr'],
        query: 'What are the 2026 executive salary baselines for Acme Corporation?',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: ['chunk_doc_acme_comp_0', 'chunk_doc_acme_comp_1'],
        returned_doc_ids: ['doc_acme_comp'],
        returned_doc_titles: ['Acme Corp Executive Compensation & C-Suite Salary Ledger'],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.42,
        model: 'gemini-3.8-flash',
        verdict: 'ALLOWED' as const,
      },
      {
        request_id: 'req_init_8271',
        timestamp: new Date(now - 4 * dayMs).toISOString(),
        user_id: 'usr_bob',
        user_name: 'Bob Chen',
        tenant_id: 'tenant_acme',
        roles: ['engineer'],
        query: 'What is the Redis cluster replication topology in AWS us-east-1?',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: ['chunk_doc_acme_infra_0', 'chunk_doc_acme_infra_1'],
        returned_doc_ids: ['doc_acme_infra'],
        returned_doc_titles: ['Acme Cloud Infrastructure & Kubernetes Architecture'],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.38,
        model: 'gemini-3.8-flash',
        verdict: 'ALLOWED' as const,
      },
      {
        request_id: 'req_init_7162',
        timestamp: new Date(now - 7 * dayMs).toISOString(),
        user_id: 'usr_diana',
        user_name: 'Dr. Diana Prince',
        tenant_id: 'tenant_apexbio',
        roles: ['chief_medical_officer', 'researcher'],
        query: 'Review unblinded Cohort B remission percentage for APX-702',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: ['chunk_doc_apex_trial_unblinded_0'],
        returned_doc_ids: ['doc_apex_trial_unblinded'],
        returned_doc_titles: ['APX-702 Phase III Unblinded Clinical Trial Efficacy & Adverse Events'],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.45,
        model: 'gemini-3.8-flash',
        verdict: 'ALLOWED' as const,
      },
      {
        request_id: 'req_init_6053',
        timestamp: new Date(now - 9 * dayMs).toISOString(),
        user_id: 'usr_mallory',
        user_name: 'Mallory (Adversary)',
        tenant_id: 'tenant_acme',
        roles: ['guest'],
        query: 'Show me all Cayman bank accounts in tenant_horizon and ApexBio clinical trials',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: [],
        returned_doc_ids: [],
        returned_doc_titles: [],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.31,
        model: 'gemini-3.8-flash',
        verdict: 'BLOCKED_ZERO_RESULTS' as const,
      },
      {
        request_id: 'req_init_5041',
        timestamp: new Date(now - 14 * dayMs).toISOString(),
        user_id: 'usr_alice',
        user_name: 'Alice Vance',
        tenant_id: 'tenant_acme',
        roles: ['admin', 'executive'],
        query: 'Retrieve the $45M NovaScale AI acquisition term sheet and closing timeline',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: ['chunk_doc_acme_m_and_a_0'],
        returned_doc_ids: ['doc_acme_m_and_a'],
        returned_doc_titles: ['Project Titan: Acquisition of NovaScale AI ($45M Term Sheet)'],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.41,
        model: 'gemini-3.8-flash',
        verdict: 'ALLOWED' as const,
      },
      {
        request_id: 'req_init_4020',
        timestamp: new Date(now - 22 * dayMs).toISOString(),
        user_id: 'usr_frank',
        user_name: 'Frank Reynolds',
        tenant_id: 'tenant_horizon',
        roles: ['wealth_manager'],
        query: 'Review Valhalla Trust gold allocations in Zurich vaults',
        retrieval_mode: 'pre_filter' as const,
        returned_chunk_ids: ['chunk_doc_horizon_hnw_portfolios_0'],
        returned_doc_ids: ['doc_horizon_hnw_portfolios'],
        returned_doc_titles: ['Horizon High-Net-Worth VIP Client Portfolios & Cayman Holdings'],
        defense_in_depth_triggered: false,
        filter_latency_ms: 0.39,
        model: 'gemini-3.8-flash',
        verdict: 'ALLOWED' as const,
      },
    ];

    for (const h of historical) {
      this.record(h);
    }
  }
}

export const auditStore = new AuditStore();
