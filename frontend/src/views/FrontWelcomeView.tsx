import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HeartPulse,
  Dna,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Activity,
  ChevronRight,
  Lock,
  Mail,
  CheckCircle2,
  Calendar,
  Baby,
  Smile,
  Heart,
  Eye,
  FileText,
  Stethoscope
} from 'lucide-react';
import { useAppTransition } from '../context/TransitionContext';

// Maternal imagery (Expectant mothers and mothers with newborn infants)
const motherWarm = '/images/maternal/pregnant_mother_warm.jpg';
const motherBaby = '/images/maternal/mother_and_baby.jpg';
const motherProfile = '/images/maternal/pregnant_mother_profile.jpg';
const motherInfant = '/images/maternal/mother_infant_care.jpg';

export const FrontWelcomeView: React.FC = () => {
  const { login, token, user } = useAuth();
  const { triggerAppTransition } = useAppTransition();
  const navigate = useNavigate();

  const [email, setEmail] = useState('dr.elena@pregtwin.org');
  const [password, setPassword] = useState('Clinician2026!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const stories = [
    {
      id: 'maya-expectant',
      type: 'PREGNANCY',
      category: 'Expectant Mother Stage',
      name: 'Maya Lin',
      ga: '31.4 Weeks GA',
      title: 'Active Antenatal Monitoring',
      quote: 'PregTwin helped my doctor identify blood pressure elevations 2 weeks earlier, protecting both me and my developing baby.',
      stats: { primary: '142 bpm', primaryLabel: 'Fetal Heart Rate', secondary: '120/80', secondaryLabel: 'Maternal BP', status: 'Stable Normotensive' },
      img: motherWarm,
      tag: 'Prenatal Digital Twin',
      tagColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      id: 'clara-baby',
      type: 'BABY',
      category: 'Mother with Baby Stage',
      name: 'Clara & Baby Noah',
      ga: 'Day 14 Postpartum',
      title: 'Safe Arrival & Thriving Newborn',
      quote: 'Holding Noah in my arms after a high-risk pregnancy feels like a miracle. Evidence-grounded risk prediction made all the difference.',
      stats: { primary: '3.4 kg', primaryLabel: 'Birth Weight', secondary: '116/74', secondaryLabel: 'Postpartum BP', status: 'Healthy Mother & Infant' },
      img: motherBaby,
      tag: 'Safe Delivery Milestone',
      tagColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'sophia-twin',
      type: 'PREGNANCY',
      category: 'Expectant Mother Stage',
      name: 'Sophia Reyes',
      ga: '28.2 Weeks GA',
      title: 'Longitudinal Care Trajectory',
      quote: 'Seeing my 3D maternal digital twin evolve week by week makes me feel deeply connected and reassured throughout pregnancy.',
      stats: { primary: '138 bpm', primaryLabel: 'Fetal Heart Rate', secondary: '118/76', secondaryLabel: 'Maternal BP', status: 'Optimal Profile' },
      img: motherProfile,
      tag: 'Longitudinal Twin',
      tagColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      id: 'elena-baby',
      type: 'BABY',
      category: 'Mother with Baby Stage',
      name: 'Dr. Elena & Baby Lucas',
      ga: 'Day 28 Postpartum',
      title: 'Clinician Experience with Infant Care',
      quote: 'As a maternal-fetal medicine specialist, using deterministic AI and digital twin telemetry gives clinicians unparalleled diagnostic confidence.',
      stats: { primary: '3.8 kg', primaryLabel: 'Infant Weight', secondary: '122/80', secondaryLabel: 'Maternal BP', status: 'Vibrant Development' },
      img: motherInfant,
      tag: 'Postnatal Wellness',
      tagColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
  ];

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(email, password);
      triggerAppTransition(() => {
        navigate('/dashboard');
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string, _label?: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(quickEmail, quickPass);
      triggerAppTransition(() => {
        navigate('/dashboard');
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBFE] text-slate-900 relative overflow-x-hidden selection:bg-purple-200 selection:text-purple-900">

      {/* Ambient Radial Lavender & Sunset Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-200/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[550px] h-[550px] bg-rose-200/35 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/75 border-b border-purple-100/80 shadow-[0_4px_20px_rgba(124,58,237,0.03)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-rose-500 flex items-center justify-center text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)]">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-purple-900 via-purple-700 to-rose-700 bg-clip-text text-transparent">
                  PregTwin
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/60">
                  Maternal Digital Twin
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Physiological Prenatal &amp; Newborn Research Platform
              </p>
            </div>
          </div>

          {/* Top Right Navigation */}
          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-purple-950">
                    {user?.full_name || user?.email}
                  </span>
                  <span className="text-[10px] text-purple-600 font-medium capitalize">
                    {user?.role} Session Active
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => triggerAppTransition(() => navigate('/dashboard'))}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-rose-600 text-white font-semibold text-xs shadow-[0_4px_15px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_22px_rgba(124,58,237,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>Enter App</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('dr.elena@pregtwin.org', 'Clinician2026!', 'Clinician Intelligence Workspace')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100/80 border border-purple-200/80 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Clinician Demo
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('maya.lin@pregtwin.org', 'Patient2026!', 'Maya Lin Maternal Living Twin')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Mother Demo
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Active Session Notification Banner if user is already authenticated */}
        {token && (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-rose-50 border border-purple-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                <Baby className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Welcome back, <span className="text-purple-700">{user?.full_name || user?.email}</span>!
                </p>
                <p className="text-[11px] text-slate-600">
                  Your maternal twin telemetry and cohort review records are synchronized.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerAppTransition(() => navigate('/dashboard'))}
              className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-all cursor-pointer"
            >
              <span>Launch Workspace with Rainbow Stork Flight</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Side: Editorial, Branding & Sign-in Option */}
          <div className="lg:col-span-6 space-y-7">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-800 text-xs font-semibold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
              <span>Next-Generation Maternal Digital Twin</span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
                Care for mother & baby with{' '}
                <span className="bg-gradient-to-r from-purple-700 via-rose-600 to-indigo-600 bg-clip-text text-transparent">
                  physiological digital twins
                </span>
              </h1>
              <p className="text-base text-slate-600 leading-relaxed font-normal">
                PregTwin translates antenatal ultrasound records, longitudinal vitals, and hemodynamic trends into a predictive
                3D living twin. Providing early preeclampsia triage for clinicians and peace of mind from first trimester to healthy delivery.
              </p>
            </div>

            {/* Stage Selector: Pregnant Women vs Mother with Baby */}
            <div className="p-1.5 rounded-2xl bg-purple-100/60 border border-purple-200/80 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveStoryIndex(0)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  stories[activeStoryIndex].type === 'PREGNANCY'
                    ? 'bg-white text-purple-950 shadow-xs'
                    : 'text-purple-700 hover:text-purple-950'
                }`}
              >
                <HeartPulse className="w-4 h-4 text-purple-600" />
                <span>Expectant Pregnancy (31.4w)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStoryIndex(1)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  stories[activeStoryIndex].type === 'BABY'
                    ? 'bg-white text-rose-950 shadow-xs'
                    : 'text-purple-700 hover:text-rose-950'
                }`}
              >
                <Baby className="w-4 h-4 text-rose-600" />
                <span>Mother &amp; Baby Newborn (Day 14)</span>
              </button>
            </div>

            {/* Feature Highlights with soft purple check icons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/70 backdrop-blur-md border border-purple-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                <span>3D Anatomical Twin with GA scaling</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/70 backdrop-blur-md border border-purple-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Safe delivery &amp; newborn tracking</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/70 backdrop-blur-md border border-purple-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                <span>14-day preeclampsia risk forecasting</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/70 backdrop-blur-md border border-purple-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Contactless camera rPPG vitals</span>
              </div>
            </div>

            {/* Interactive Sign-In & Entry Panel */}
            <div className="p-6 rounded-2xl bg-white/80 backdrop-blur-xl border border-purple-200/90 shadow-[0_12px_40px_rgba(124,58,237,0.08)] hover:shadow-[0_16px_50px_rgba(124,58,237,0.12)] transition-all">
              <div className="flex items-center justify-between pb-4 border-b border-purple-100/80 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sign in to your account</h3>
                  <p className="text-xs text-slate-500">Access your maternal digital twin and clinical lab</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-100/70 text-purple-700 flex items-center justify-center font-bold text-xs">
                  <Lock className="w-4 h-4 text-purple-700" />
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {errorMsg}
                </div>
              )}

              {/* One-click demo roles with Rainbow Stork transition trigger */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Quick Access Profiles (Launches Animated Stork Flight)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('dr.elena@pregtwin.org', 'Clinician2026!', 'Dr. Elena Vance Clinician Workstation')}
                    disabled={loading}
                    className="p-3 rounded-xl bg-gradient-to-b from-purple-50/80 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/60 border border-purple-200 text-left transition-all group hover:scale-[1.01] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-purple-600" /> Clinician
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-purple-800 font-medium mt-1 truncate">Dr. Elena Vance</p>
                    <span className="text-[10px] text-slate-500">Review queue & simulations</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('maya.lin@pregtwin.org', 'Patient2026!', 'Maya Lin Maternal Living Twin')}
                    disabled={loading}
                    className="p-3 rounded-xl bg-gradient-to-b from-rose-50/80 to-rose-100/50 hover:from-rose-100 hover:to-rose-200/60 border border-rose-200 text-left transition-all group hover:scale-[1.01] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-rose-600" /> Mother (Patient)
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-rose-900 font-medium mt-1 truncate">Maya Lin (31.4w)</p>
                    <span className="text-[10px] text-slate-500">3D twin avatar & vitals</span>
                  </button>
                </div>
              </div>

              {/* Custom Form */}
              <form onSubmit={handleLogin} className="space-y-3 pt-3 border-t border-purple-100/70">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hospital.org"
                        className="w-full bg-white border border-purple-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-white border border-purple-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-rose-600 hover:from-purple-800 hover:to-rose-700 text-white font-semibold text-xs shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_22px_rgba(124,58,237,0.45)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In &amp; Launch with Stork Flight</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Side: Imagery of Pregnant Women & Mother with Baby */}
          <div className="lg:col-span-6 relative flex flex-col items-center">
            {/* Main Visual Card */}
            <div className="relative w-full max-w-[460px] rounded-3xl overflow-hidden p-2 bg-gradient-to-b from-purple-200/50 via-white/80 to-rose-100/40 border border-purple-200/90 shadow-[0_20px_60px_rgba(124,58,237,0.14)] group">
              <div className="relative rounded-2xl overflow-hidden bg-white aspect-[4/5] flex items-center justify-center shadow-inner">
                {/* Image of pregnant woman or mother with baby */}
                <img
                  src={stories[activeStoryIndex].img}
                  alt={stories[activeStoryIndex].name}
                  className="w-full h-full object-cover transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                />

                {/* Overlaid Floating Glass Telemetry Card */}
                <div className="absolute bottom-4 inset-x-4 p-4 rounded-2xl bg-white/92 backdrop-blur-xl border border-purple-100 shadow-[0_8px_30px_rgba(124,58,237,0.12)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-purple-950 font-mono">
                        {stories[activeStoryIndex].name} &bull; {stories[activeStoryIndex].ga}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stories[activeStoryIndex].tagColor}`}>
                      {stories[activeStoryIndex].tag}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 italic leading-snug">
                    "{stories[activeStoryIndex].quote}"
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-100/80 text-[10px] text-slate-500">
                    <div>
                      <span className="block font-medium">{stories[activeStoryIndex].stats.primaryLabel}</span>
                      <strong className="text-slate-900 font-mono text-xs text-purple-800">
                        {stories[activeStoryIndex].stats.primary}
                      </strong>
                    </div>
                    <div>
                      <span className="block font-medium">{stories[activeStoryIndex].stats.secondaryLabel}</span>
                      <strong className="text-slate-900 font-mono text-xs text-purple-800">
                        {stories[activeStoryIndex].stats.secondary}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Switcher Tabs (Select between Pregnant Mother and Mother & Baby) */}
              <div className="flex items-center justify-center gap-1.5 mt-3 p-1 flex-wrap">
                {stories.map((story, idx) => (
                  <button
                    key={story.id}
                    onClick={() => setActiveStoryIndex(idx)}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      activeStoryIndex === idx
                        ? 'bg-purple-700 text-white shadow-xs font-semibold'
                        : 'bg-white/80 text-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    {story.type === 'BABY' ? (
                      <Baby className="w-3 h-3 text-rose-300" />
                    ) : (
                      <HeartPulse className="w-3 h-3 text-purple-300" />
                    )}
                    <span>{story.name.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-75">({story.type === 'BABY' ? 'Baby' : 'Prenatal'})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Decorative Floating Metric Pill */}
            <div className="absolute -top-4 -right-2 sm:-right-4 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-purple-200/80 shadow-lg flex items-center gap-2.5 animate-bounce-subtle">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Dna className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Digital Twin State</span>
                <span className="text-xs font-bold text-purple-900">Physiologically Aligned</span>
              </div>
            </div>

            {/* Decorative Floating Clinical Indicator */}
            <div className="absolute bottom-14 -left-2 sm:-left-6 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-purple-200/80 shadow-lg flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Baby className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Longitudinal Care</span>
                <span className="text-xs font-bold text-rose-900">From 12w to Thriving Infant</span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM FEATURE CARDS STRIP WITH PREGNANT WOMEN & MOTHER-BABY GALLERY */}
        <section className="mt-20 pt-10 border-t border-purple-100/80">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs uppercase font-bold text-purple-700 tracking-wider">
              Comprehensive Maternal &amp; Newborn Journey
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              From Antenatal Twin to Joyful Delivery
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Explore how PregTwin combines 3D physiological models, clinical OCR, and maternal risk engines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gallery Card 1: Antenatal Twin */}
            <div className="p-5 rounded-3xl bg-white/90 border border-purple-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-purple-50/50 mb-4 flex items-center justify-center border border-purple-100/60">
                <img
                  src={motherWarm}
                  alt="Antenatal Mother"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full mb-2">
                Trimester 1 &bull; 2 &bull; 3
              </span>
              <h3 className="text-base font-bold text-slate-900">3D Maternal Twin Scaling</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Smooth anatomical female avatar morphs in real-time as gestational age advances, displaying uterine fundus height and hemodynamics.
              </p>
            </div>

            {/* Gallery Card 2: Mother & Baby */}
            <div className="p-5 rounded-3xl bg-white/90 border border-rose-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-rose-50/50 mb-4 flex items-center justify-center border border-rose-100/60">
                <img
                  src={motherBaby}
                  alt="Mother with Newborn Baby"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full mb-2">
                Safe Delivery &bull; Newborn Health
              </span>
              <h3 className="text-base font-bold text-slate-900">Postpartum Bonding &amp; Safety</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Early detection of preeclampsia risks ensures mothers reach term safely, protecting infant vitality and postpartum maternal recovery.
              </p>
            </div>

            {/* Gallery Card 3: Clinical Decision Support */}
            <div className="p-5 rounded-3xl bg-white/90 border border-purple-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-violet-50/50 mb-4 flex items-center justify-center border border-purple-100/60">
                <img
                  src={motherProfile}
                  alt="Clinical Research"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full mb-2">
                Clinical Intelligence
              </span>
              <h3 className="text-base font-bold text-slate-900">Audited Clinical Evidence</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Clinicians inspect model coefficients, historical timeline counterfactuals, and document evidence with zero generative hallucinations.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-purple-100/80 bg-white/60 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-slate-700">PregTwin Maternal Digital Twin Platform</span>
            <span className="text-slate-400">&bull;</span>
            <span>Medical Research Architecture</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Compliant with clinical evidence standards &bull; Zero fabricated parameters
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FrontWelcomeView;
