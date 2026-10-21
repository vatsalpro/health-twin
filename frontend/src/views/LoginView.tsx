import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dna, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('dr.elena@pregtwin.org');
  const [password, setPassword] = useState<string>('Clinician2026!');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setQuickCreds = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient physiological light sphere */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md shadow-xl border-slate-200 relative z-10">
        <CardContent className="p-8 space-y-6">
          {/* Brand */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-sky-600/20">
              <Dna className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">PregTwin</h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Understand the journey. Visualize the change. Support earlier clinical review.
            </p>
          </div>

          {errorMsg && (
            <Alert
              variant="danger"
              title="Authentication Error"
              description={errorMsg}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  placeholder="clinician@hospital.org"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center text-sm py-2.5 font-semibold"
              disabled={loading}
              isLoading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Platform
            </Button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block text-center">
              One-Click Research Demo Profiles
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickCreds('dr.elena@pregtwin.org', 'Clinician2026!')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" /> Clinician
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">Dr. Elena Vance</p>
              </button>

              <button
                type="button"
                onClick={() => setQuickCreds('maya.lin@pregtwin.org', 'Patient2026!')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-sky-700 font-semibold text-xs">
                  <UserCheck className="w-3.5 h-3.5" /> Patient
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">Maya Lin (31.4w)</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
