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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

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
      <PageHeader
        badge="SYSTEM DIAGNOSTICS & PROVIDERS"
        title="Platform Architecture & Configuration"
        description="Transparent inspection of persistent storage, AI adapters, OCR engine status, and model parameters."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadDiagnostics}
            isLoading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Status
          </Button>
        }
      />

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Extraction Provider Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              <CardTitle className="text-sm">AI Extraction & Summary Provider</CardTitle>
            </div>
            {!diagnostics?.ai_provider.fallback_active ? (
              <Badge variant="success">
                {diagnostics?.ai_provider.configured_provider === 'ollama' ? 'OLLAMA ONLINE' : 'OPENAI ONLINE'}
              </Badge>
            ) : (
              <Badge variant="warning">FALLBACK ACTIVE</Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 font-medium">Configured Adapter:</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {diagnostics?.ai_provider.configured_provider === 'ollama'
                    ? 'Local Ollama (Offline / On-Device)'
                    : (diagnostics?.ai_provider.configured_provider || 'openai')}
                </span>
              </div>

              {diagnostics?.ai_provider.configured_provider === 'ollama' ? (
                <>
                  <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 font-medium">Local Model:</span>
                    <span className="font-mono text-sky-800 font-bold">
                      {diagnostics?.ai_provider.ollama_model || 'llama3.2:3b'}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 font-medium">Ollama Service API:</span>
                    <span className="font-mono text-slate-900">
                      {diagnostics?.ai_provider.ollama_base_url || 'http://localhost:11434'} (
                      {diagnostics?.ai_provider.ollama_reachable ? (
                        <span className="text-emerald-700 font-bold">Reachable</span>
                      ) : (
                        <span className="text-rose-600 font-bold">Offline</span>
                      )}
                      )
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 font-medium">OpenAI Key Configured:</span>
                  <span className="font-mono text-slate-900">
                    {diagnostics?.ai_provider.openai_api_key_set ? 'Yes (Stored in backend .env)' : 'No (Using local rules)'}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {diagnostics?.ai_provider.notice}
            </p>
          </CardContent>
        </Card>

        {/* OCR Engine Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-sm">Optical Character Recognition (OCR)</CardTitle>
            </div>
            <Badge variant="primary">
              {diagnostics?.ocr_engine.is_installed ? 'TESSERACT FOUND' : 'PYMUPDF ACTIVE'}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 font-medium">OCR Engine:</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {diagnostics?.ocr_engine.configured_engine || 'tesseract'}
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 font-medium">Native PDF Text Extraction:</span>
                <span className="font-mono text-emerald-700 font-semibold">PyMuPDF 2.0 (Active)</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {diagnostics?.ocr_engine.notice}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Environment Setup Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-700" />
            <CardTitle className="text-sm">Backend Environment Configuration (`backend/.env`)</CardTitle>
          </div>
          <CardDescription>
            Configuration parameters supported by the PregTwin Python FastAPI backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`# AI Provider Configuration (Ollama / Local LLM)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT_SECONDS=30.0

# Optional Local OCR Engine (Windows/Linux)
OCR_ENGINE=tesseract
TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
