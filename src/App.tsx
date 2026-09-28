/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QueryPlayground } from './components/QueryPlayground';
import { LeakageTestSuite } from './components/LeakageTestSuite';
import { DocumentAclManager } from './components/DocumentAclManager';
import { AuditLogViewer } from './components/AuditLogViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { ResumeSnippetModal } from './components/ResumeSnippetModal';
import { TokenInspectorModal } from './components/TokenInspectorModal';
import { apiClient, PersonaWithToken, TenantInfo } from './services/apiClient';
import { Document, LeakageSuiteSummary } from './types/rag';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'playground' | 'testsuite' | 'documents' | 'audit' | 'architecture'
  >('playground');

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [personas, setPersonas] = useState<PersonaWithToken[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<PersonaWithToken | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [summary, setSummary] = useState<LeakageSuiteSummary | null>(null);

  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [personasRes, docsRes] = await Promise.all([
        apiClient.getPersonas(),
        apiClient.getDocuments(),
      ]);

      setTenants(personasRes.tenants);
      setPersonas(personasRes.personas);
      setDocuments(docsRes.documents);

      if (!selectedPersona && personasRes.personas.length > 0) {
        // Default to Bob Chen (Engineer with boundary checks) or Alice
        const defaultPersona =
          personasRes.personas.find((p) => p.id === 'usr_bob') ||
          personasRes.personas[0];
        setSelectedPersona(defaultPersona);
      }
    } catch (err: any) {
      console.error('Failed to initialize app data:', err);
      setError(err.message || 'Initialization failed');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Header & Persona Selector */}
      <Header
        tenants={tenants}
        personas={personas}
        selectedPersona={selectedPersona}
        onSelectPersona={setSelectedPersona}
        onOpenResumeModal={() => setIsResumeModalOpen(true)}
        onOpenTokenModal={() => setIsTokenModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <div className="text-sm font-semibold text-slate-800">
              Initializing Permission-Aware Vector Store...
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Seeding multi-tenant datasets and establishing Qdrant payload filters
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center max-w-lg mx-auto my-12">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-rose-900">Initialization Error</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 py-1.5 px-4 bg-rose-900 text-white rounded-lg text-xs font-medium"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'playground' && (
              <QueryPlayground
                selectedPersona={selectedPersona}
                onRefreshAudit={() => {
                  // Trigger audit updates when queries are executed
                }}
              />
            )}

            {activeTab === 'testsuite' && (
              <LeakageTestSuite
                onOpenResumeModal={() => setIsResumeModalOpen(true)}
              />
            )}

            {activeTab === 'documents' && (
              <DocumentAclManager
                documents={documents}
                personas={personas}
                onRefreshDocuments={loadData}
              />
            )}

            {activeTab === 'audit' && <AuditLogViewer documents={documents} />}

            {activeTab === 'architecture' && <ArchitectureGuide />}
          </>
        )}
      </main>

      {/* Modals */}
      <ResumeSnippetModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        summary={summary}
      />

      <TokenInspectorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        persona={selectedPersona}
      />
    </div>
  );
}
