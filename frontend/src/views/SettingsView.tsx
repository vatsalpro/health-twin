import React, { useEffect, useState } from 'react';
import { api, SystemDiagnostics } from '../api/client';
import {
  Settings,
  Shield,
  Cpu,
  Database,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemDiagnostics();
      setDiagnostics(data);
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <span className="text-xs font-mono text-[#5BE7E8] uppercase tracking-wider block">
            SYSTEM DIAGNOSTICS & PROVIDERS
          </span>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">Platform Architecture & Configuration</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Transparent inspection of persistent storage, AI adapters, OCR engine status, and model parameters.
          </p>
        </div>

        <button
          onClick={loadDiagnostics}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#142137] hover:bg-[#192a45] text-xs font-medium text-[#5BE7E8] border border-[rgba(166,190,220,0.18)] transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Extraction Provider Status */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F4F7FC] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#5BE7E8]" />
              AI Extraction & Summary Provider
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                diagnostics?.ai_provider.openai_api_key_set
                  ? 'bg-[#43D6B0]/20 text-[#43D6B0]'
                  : 'bg-[#E9B96E]/20 text-[#E9B96E]'
              }`}
            >
              {diagnostics?.ai_provider.openai_api_key_set ? 'ONLINE' : 'FALLBACK ACTIVE'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 bg-[#0B1220]/70 rounded-lg">
              <span className="text-[#A5B3C8]">Configured Adapter:</span>
              <span className="font-mono text-[#F4F7FC] font-semibold">
                {diagnostics?.ai_provider.configured_provider || 'openai'}
              </span>
            </div>
            <div className="flex justify-between p-2.5 bg-[#0B1220]/70 rounded-lg">
              <span className="text-[#A5B3C8]">OpenAI Key Configured:</span>
              <span className="font-mono text-[#F4F7FC]">
                {diagnostics?.ai_provider.openai_api_key_set ? 'Yes (Stored in backend .env)' : 'No (Using local rules)'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#A5B3C8] leading-relaxed bg-[#101A2B] p-3 rounded-xl border border-[rgba(166,190,220,0.1)]">
            {diagnostics?.ai_provider.notice}
          </p>
        </div>

        {/* OCR Engine Status */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F4F7FC] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#43D6B0]" />
              Optical Character Recognition (OCR)
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                diagnostics?.ocr_engine.is_installed
                  ? 'bg-[#43D6B0]/20 text-[#43D6B0]'
                  : 'bg-[#5BE7E8]/20 text-[#5BE7E8]'
              }`}
            >
              {diagnostics?.ocr_engine.is_installed ? 'TESSERACT FOUND' : 'PYMUPDF ACTIVE'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 bg-[#0B1220]/70 rounded-lg">
              <span className="text-[#A5B3C8]">OCR Engine:</span>
              <span className="font-mono text-[#F4F7FC] font-semibold">
                {diagnostics?.ocr_engine.configured_engine || 'tesseract'}
              </span>
            </div>
            <div className="flex justify-between p-2.5 bg-[#0B1220]/70 rounded-lg">
              <span className="text-[#A5B3C8]">Native PDF Text Extraction:</span>
              <span className="font-mono text-[#43D6B0]">PyMuPDF 2.0 (Active)</span>
            </div>
          </div>

          <p className="text-[11px] text-[#A5B3C8] leading-relaxed bg-[#101A2B] p-3 rounded-xl border border-[rgba(166,190,220,0.1)]">
            {diagnostics?.ocr_engine.notice}
          </p>
        </div>
      </div>

      {/* Environment Setup Instructions */}
      <div className="glass-panel p-6 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-[#F4F7FC] flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#5BE7E8]" />
          Backend Environment Configuration (`backend/.env`)
        </h3>
        <p className="text-xs text-[#A5B3C8]">
          To activate live OpenAI GPT-4o report extraction, populate your API key in `backend/.env` and restart the backend service:
        </p>
        <pre className="p-4 bg-[#070B14] rounded-xl border border-[rgba(166,190,220,0.14)] text-xs font-mono text-[#5BE7E8] overflow-x-auto">
{`# AI Provider Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your-openai-api-key...
OPENAI_MODEL=gpt-4o

# Optional Local OCR Engine (Windows/Linux)
OCR_ENGINE=tesseract
TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe`}
        </pre>
      </div>
    </div>
  );
};
