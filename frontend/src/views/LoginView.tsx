import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dna, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-6 grid-bg relative overflow-hidden">
      {/* Background ambient physiological light sphere */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#5BE7E8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-panel-elevated p-8 rounded-2xl relative z-10 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5BE7E8] via-[#43D6B0] to-[#628BFF] flex items-center justify-center font-bold text-[#070B14] mx-auto shadow-xl shadow-[#5BE7E8]/20">
            <Dna className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F7FC]">PregTwin</h1>
          <p className="text-xs text-[#A5B3C8]">
            Understand the journey. Visualize the change. Support earlier clinical review.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#F43F5E]/15 border border-[#F43F5E]/30 rounded-xl text-xs text-[#F43F5E] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A5B3C8] absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-xl pl-9 pr-3 py-2.5 text-[#F4F7FC] focus:outline-none focus:border-[#5BE7E8]"
                placeholder="clinician@hospital.org"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A5B3C8] absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-xl pl-9 pr-3 py-2.5 text-[#F4F7FC] focus:outline-none focus:border-[#5BE7E8]"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#5BE7E8] to-[#43D6B0] hover:opacity-95 text-[#070B14] font-bold rounded-xl shadow-lg shadow-[#5BE7E8]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Platform</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div className="pt-4 border-t border-[rgba(166,190,220,0.1)] space-y-2">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block text-center">
            One-Click Research Demo Profiles
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setQuickCreds('dr.elena@pregtwin.org', 'Clinician2026!')}
              className="p-2.5 rounded-xl bg-[#101A2B] hover:bg-[#142137] border border-[rgba(166,190,220,0.14)] text-left transition-all"
            >
              <div className="flex items-center gap-1.5 text-[#E9B96E] font-medium text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> Clinician
              </div>
              <p className="text-[10px] text-[#A5B3C8] mt-0.5 truncate">Dr. Elena Vance</p>
            </button>

            <button
              type="button"
              onClick={() => setQuickCreds('maya.lin@pregtwin.org', 'Patient2026!')}
              className="p-2.5 rounded-xl bg-[#101A2B] hover:bg-[#142137] border border-[rgba(166,190,220,0.14)] text-left transition-all"
            >
              <div className="flex items-center gap-1.5 text-[#5BE7E8] font-medium text-[11px]">
                <UserCheck className="w-3.5 h-3.5" /> Patient
              </div>
              <p className="text-[10px] text-[#A5B3C8] mt-0.5 truncate">Maya Lin (31.4w)</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
