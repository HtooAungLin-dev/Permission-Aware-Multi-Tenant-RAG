import React from 'react';
import { KeyRound, ShieldCheck, Copy, Check } from 'lucide-react';
import { PersonaWithToken } from '../services/apiClient';

interface TokenInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaWithToken | null;
}

export const TokenInspectorModal: React.FC<TokenInspectorModalProps> = ({
  isOpen,
  onClose,
  persona,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !persona) return null;

  const parts = persona.jwt_token.split('.');
  let decodedHeader = {};
  let decodedPayload = {};

  try {
    decodedHeader = JSON.parse(atob(parts[0]));
    decodedPayload = JSON.parse(atob(parts[1]));
  } catch (e) {
    // fallback
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(persona.jwt_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Verified JWT Claims: {persona.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs font-mono"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-600">
          The server extracts tenant identity and role clearance exclusively from this cryptographically verified token. Any tenant or role values passed in the HTTP request body are strictly ignored.
        </p>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Decoded Claims Payload (Derives Vector Filter)
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(decodedPayload, null, 2)}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              <span>Raw Bearer Token</span>
              <button
                onClick={handleCopy}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-mono inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded font-mono text-[10px] text-slate-600 break-all select-all max-h-24 overflow-y-auto">
              {persona.jwt_token}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-900 text-white rounded-lg text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
