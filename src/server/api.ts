import express, { Request, Response } from 'express';
import { ClassificationLevel, Document } from '../types/rag';
import { auditStore } from './auditStore';
import { runLeakageTestSuite } from './leakageSuite';
import {
  documentDb,
  executeRagPipeline,
  ingestDocumentChunks,
  updateDocumentPermissions,
} from './ragService';
import { issueUserToken, TENANTS, USER_PERSONAS } from './seedData';

export const apiRouter = express.Router();

apiRouter.use(express.json());

/**
 * GET /api/rag/personas
 * Lists personas with real issued JWT tokens for seamless testing.
 */
apiRouter.get('/personas', (req: Request, res: Response) => {
  const personasWithTokens = USER_PERSONAS.map((p) => ({
    ...p,
    jwt_token: issueUserToken(p),
  }));

  res.json({
    tenants: TENANTS,
    personas: personasWithTokens,
  });
});

/**
 * GET /api/rag/documents
 * Returns list of documents and current ACLs.
 */
apiRouter.get('/documents', (req: Request, res: Response) => {
  const docs = Array.from(documentDb.values());
  res.json({ documents: docs });
});

/**
 * POST /api/rag/query
 * Main RAG retrieval & generation endpoint.
 * Note: req.body may contain bodySpoofedTenantId or bodySpoofedRoles to test resistance.
 * The server derives identity solely from req.headers.authorization or token in body.
 */
apiRouter.post('/query', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body.token) {
      token = req.body.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'No JWT token provided in Authorization header or body.',
      });
    }

    const {
      query,
      bodySpoofedTenantId,
      bodySpoofedRoles,
      retrievalMode,
      simulateLayer2Failure,
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'QUERY_REQUIRED', message: 'Query string is required.' });
    }

    const trace = await executeRagPipeline({
      token,
      query,
      bodySpoofedTenantId,
      bodySpoofedRoles,
      retrievalMode: retrievalMode || 'pre_filter',
      simulateLayer2Failure: Boolean(simulateLayer2Failure),
    });

    res.json(trace);
  } catch (err: any) {
    res.status(500).json({
      error: 'PIPELINE_ERROR',
      message: err.message || 'Error executing RAG pipeline',
    });
  }
});

/**
 * POST /api/rag/test-suite
 * Executes the CI adversarial leakage test suite.
 */
apiRouter.post('/test-suite', async (req: Request, res: Response) => {
  try {
    const summary = await runLeakageTestSuite();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({
      error: 'TEST_SUITE_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /api/rag/revoke
 * Updates document ACL and measures propagation latency.
 */
apiRouter.post('/revoke', (req: Request, res: Response) => {
  try {
    const { docId, allowedRoles, allowedUsers, classificationLevel } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'DOC_ID_REQUIRED' });
    }

    const result = updateDocumentPermissions(docId, {
      allowed_roles: allowedRoles || [],
      allowed_users: allowedUsers || [],
      classification_level: classificationLevel as ClassificationLevel,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'REVOCATION_FAILED', message: err.message });
  }
});

/**
 * GET /api/rag/audit
 * Search append-only audit log.
 */
apiRouter.get('/audit', (req: Request, res: Response) => {
  const { tenantId, userId, verdict, query, limit } = req.query;

  const logs = auditStore.search({
    tenantId: tenantId ? String(tenantId) : undefined,
    userId: userId ? String(userId) : undefined,
    verdict: verdict ? String(verdict) : undefined,
    query: query ? String(query) : undefined,
    limit: limit ? Number(limit) : 50,
  });

  res.json({ logs });
});

/**
 * GET /api/rag/audit/doc-history
 * Answers "Who retrieved document X in the last 30 days?"
 */
apiRouter.get('/audit/doc-history', (req: Request, res: Response) => {
  const { docId, days } = req.query;

  if (!docId || typeof docId !== 'string') {
    return res.status(400).json({ error: 'DOC_ID_REQUIRED' });
  }

  const history = auditStore.getRetrievalsForDocument(
    docId,
    days ? Number(days) : 30
  );

  res.json(history);
});

/**
 * POST /api/rag/ingest
 * Ingests a new document and chunks it, strictly enforcing tenant_id invariant.
 */
apiRouter.post('/ingest', (req: Request, res: Response) => {
  try {
    const { id, title, category, tenantId, allowedRoles, allowedUsers, classificationLevel, content, summary } =
      req.body;

    if (!tenantId || tenantId.trim() === '') {
      return res.status(400).json({
        error: 'INGESTION_REJECTED',
        message: 'Strict invariant violation: tenant_id is required. Unprotected documents are forbidden.',
      });
    }

    const doc: Document = {
      id: id || `doc_${Date.now()}`,
      title: title || 'Custom Document',
      category: category || 'General',
      tenant_id: tenantId,
      tenant_name: TENANTS.find((t) => t.id === tenantId)?.name || tenantId,
      acl: {
        tenant_id: tenantId,
        allowed_roles: allowedRoles || ['*'],
        allowed_users: allowedUsers || [],
        classification_level: classificationLevel || 'internal',
      },
      summary: summary || content?.substring(0, 120) || '',
      content: content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chunkCount: 0,
    };

    const chunks = ingestDocumentChunks(doc);
    doc.chunkCount = chunks.length;
    documentDb.set(doc.id, doc);

    res.json({
      success: true,
      document: doc,
      chunksCreated: chunks.length,
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'INGESTION_ERROR',
      message: err.message,
    });
  }
});
