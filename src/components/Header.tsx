import React from 'react';
import {
  ShieldCheck,
  KeyRound,
  FileCheck2,
  Award,
  Building2,
  Lock,
} from 'lucide-react';
import { PersonaWithToken, TenantInfo } from '../services/apiClient';

interface HeaderProps {
  tenants: TenantInfo[];
  personas: PersonaWithToken[];
  selectedPersona: PersonaWithToken | null;
  onSelectPersona: (persona: PersonaWithToken) => void;
  onOpenResumeModal: () => void;
  onOpenTokenModal: () => void;
  activeTab: 'playground' | 'testsuite' | 'documents' | 'audit' | 'architecture';
  setActiveTab: (tab: 'playground' | 'testsuite' | 'documents' | 'audit' | 'architecture') => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenants,
  personas,
  selectedPersona,
  onSelectPersona,
  onOpenResumeModal,
  onOpenTokenModal,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                  Permission-Aware Multi-Tenant RAG
                </h1>
                <span className="text-xs text-slate-500 font-mono">v2.4</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Pre-retrieval vector ACL filtering · Token-derived identity · Append-only audit
              </p>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            {/* Persona Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
              <label htmlFor="persona-select" className="text-xs text-slate-500 font-medium pl-2 hidden md:inline">
                Persona:
              </label>
              <select
                id="persona-select"
                value={selectedPersona?.id || ''}
                onChange={(e) => {
                  const found = personas.find((p) => p.id === e.target.value);
                  if (found) onSelectPersona(found);
                }}
                className="text-xs font-medium text-slate-800 bg-transparent py-1 px-2 focus:outline-none cursor-pointer"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.tenant_name.split(' ')[0]} - {p.roles.join(', ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Token Claims button */}
            <button
              onClick={onOpenTokenModal}
              title="Inspect Verified JWT Token Claims"
              className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Inspect JWT</span>
            </button>

            {/* Resume line modal */}
            <button
              onClick={onOpenResumeModal}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Resume Line</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between py-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('playground')}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'playground'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              RAG Playground
            </button>

            <button
              onClick={() => setActiveTab('testsuite')}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'testsuite'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Leakage Test Suite</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-mono font-semibold">
                0 Leaks
              </span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'documents'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Document ACLs & Revocation
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Audit Log & Forensics
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'architecture'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Architecture & Qdrant Spec
            </button>
          </div>

          {/* Persona quick badge */}
          {selectedPersona && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>{selectedPersona.tenant_id}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedPersona.roles.join(', ')}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{selectedPersona.classification_clearance}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
