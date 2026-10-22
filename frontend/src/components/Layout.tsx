import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MaternalOrigamiBackground } from './MaternalOrigamiBackground';
import { NotificationCenter } from './NotificationCenter';
import { CraneDoctorMascot } from './CraneDoctorMascot';
import {
  LayoutDashboard,
  Dna,
  Clock,
  FileText,
  Activity,
  TrendingUp,
  FlaskConical,
  ClipboardList,
  History,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Cpu,
  Camera,
  HeartPulse,
  User,
  Shield,
  Home,
  ArrowRight,
  Sparkles,
  Pill,
  Calendar,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, selectedPatient, selectedPatientId, allPatients, setSelectedPatientId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  // Role-specific navigation groups
  const clinicianNavGroups = [
    {
      title: 'Care Coordination',
      items: [
        { to: '/dashboard', label: 'Clinical Dashboard', icon: LayoutDashboard },
        { to: '/medications', label: 'Prescriptions & Orders', icon: Pill },
        { to: '/appointments', label: 'Appointments & Schedule', icon: Calendar },
      ],
    },
    {
      title: 'Clinical Evidence',
      items: [
        { to: '/clinician/review-queue', label: 'Document Review Queue', icon: ClipboardList, badge: 'Clinical' },
        { to: '/medical-records', label: 'Antenatal Records & PDFs', icon: FileText },
        { to: '/observations', label: 'Observations & Trends', icon: Activity },
        { to: '/pregnancy-timeline', label: 'Pregnancy Timeline', icon: Clock },
      ],
    },
    {
      title: 'Digital Twin Lab',
      items: [
        { to: '/maternal-twin', label: 'Maternal Twin (3D)', icon: Dna },
        { to: '/risk-forecast', label: '14-Day Risk Research', icon: TrendingUp },
        { to: '/simulation-lab', label: 'Simulation Lab (What-If)', icon: FlaskConical },
      ],
    },
    {
      title: 'Sensing & Telemetry',
      items: [
        { to: '/measurements-devices', label: 'Vitals & Sensor Hub', icon: Cpu },
        { to: '/camera-research', label: 'Camera Stress & rPPG', icon: Camera },
      ],
    },
    {
      title: 'System & Governance',
      items: [
        { to: '/audit-history', label: 'Audit Trail', icon: History },
        { to: '/settings', label: 'Settings & Diagnostics', icon: Settings },
      ],
    },
  ];

  const patientNavGroups = [
    {
      title: 'My Pregnancy',
      items: [
        { to: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
        { to: '/ai-assistant', label: 'Ask Dr. Crane', icon: Sparkles, badge: 'AI Doctor' },
        { to: '/medications', label: 'My Medications & Doses', icon: Pill },
        { to: '/appointments', label: 'Doctor Appointments', icon: Calendar },
        { to: '/pregnancy-timeline', label: 'Care Timeline', icon: Clock },
        { to: '/maternal-twin', label: 'My Health Twin (3D)', icon: Dna },
      ],
    },
    {
      title: 'My Records & Vitals',
      items: [
        { to: '/medical-records', label: 'Medical Documents', icon: FileText },
        { to: '/observations', label: 'Health Trends', icon: Activity },
        { to: '/measurements-devices', label: 'Log My Vitals', icon: Cpu },
        { to: '/camera-research', label: 'Camera Stress & rPPG', icon: Camera, badge: 'Scan' },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/settings', label: 'Settings & Privacy', icon: Settings },
      ],
    },
  ];

  const activeNavGroups = isClinician ? clinicianNavGroups : patientNavGroups;
  const activeEpisode = selectedPatient?.episodes?.[0];
  const gaWeeks = activeEpisode?.current_gestational_age_weeks;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/20 via-transparent to-violet-50/20 text-slate-900 flex flex-col relative selection:bg-purple-200 selection:text-purple-900">
      {/* Ambient background soft light glows */}
      <div className="fixed top-0 left-1/3 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[450px] h-[450px] bg-violet-100/40 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* TOP BAR (Option on top side to return to welcome or take to main app) */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/55 border-b border-purple-200/50 shadow-[0_4px_20px_rgba(124,58,237,0.03)]">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Top Left: Brand and Welcome Screen Option */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-purple-700 rounded-xl hover:bg-purple-50 md:hidden transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-purple-600 to-violet-500 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)] group-hover:scale-105 transition-transform">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-purple-900 to-indigo-800 bg-clip-text text-transparent">
                  PregTwin
                </span>
                <span className="text-[10px] text-purple-700 font-semibold block -mt-0.5">
                  Maternal Lab
                </span>
              </div>
            </NavLink>

            {/* Top Side Action: Return to Welcome / Front Screen */}
            <NavLink
              to="/welcome"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 bg-white/60 hover:bg-white/80 border border-purple-200/80 backdrop-blur-md transition-all hover:scale-[1.02] shadow-2xs"
              title="Return to the PregTwin Front Welcome Screen"
            >
              <Home className="w-3.5 h-3.5 text-purple-600" />
              <span>Welcome Screen</span>
            </NavLink>
          </div>

          {/* Top Center: Patient Telemetry Status Pill */}
          {selectedPatient && (
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/65 border border-purple-200/80 shadow-2xs backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                {selectedPatient.first_name} {selectedPatient.last_name}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs font-mono font-semibold text-purple-700">
                {gaWeeks ? `${gaWeeks.toFixed(1)}w GA` : 'Prenatal'}
              </span>
            </div>
          )}

          {/* Top Right: AI Assistant (Patient only), Notifications, Main App, & Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Dr. Crane AI Quick Access Button - Exclusively for Patients */}
            {!isClinician && (
              <NavLink
                to="/ai-assistant"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs backdrop-blur-md ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                      : 'bg-white/70 hover:bg-white/90 text-purple-800 border border-purple-200/90 hover:scale-[1.02]'
                  }`
                }
                title="Chat with Dr. Crane AI Medical Assistant"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0 -my-1">
                  <CraneDoctorMascot size="sm" showBadge={false} />
                </div>
                <span className="hidden sm:inline">Ask Dr. Crane</span>
              </NavLink>
            )}

            {/* Persistent Shaking Notification Bell & Center */}
            <NotificationCenter />

            {/* Direct Option to take to Main App */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs backdrop-blur-md ${
                  isActive
                    ? 'bg-purple-700 text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                    : 'bg-white/70 hover:bg-white/90 text-purple-700 border border-purple-200 hover:scale-[1.02]'
                }`
              }
              title="Go to Clinical Dashboard / Main App"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Main App</span>
            </NavLink>

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-purple-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-200 to-indigo-100 text-purple-800 font-bold text-xs flex items-center justify-center border border-purple-200 shadow-2xs">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                  {user?.full_name || user?.email}
                </p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700">
                  {user?.role}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                navigate('/welcome');
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* App Body: Medial Left Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col md:flex-row w-full">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* MEDIAL LEFT SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-72' : 'hidden'
          } md:flex flex-col w-full md:w-68 backdrop-blur-2xl bg-white/55 border-r border-purple-200/50 shrink-0 md:sticky md:top-16 md:h-[calc(100vh-4rem)] transition-all shadow-[4px_0_24px_rgba(124,58,237,0.02)]`}
        >
          {/* MEDIAL LEFT SIDE HIGHLIGHT: "TAKE U TO MAIN APP" BUTTON */}
          <div className="p-3 border-b border-purple-100/70">
            <NavLink
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3 rounded-2xl font-bold text-xs transition-all duration-300 group shadow-xs backdrop-blur-md ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)]'
                    : 'bg-white/60 hover:bg-white/85 text-purple-900 border border-purple-200/80 hover:border-purple-300 hover:shadow-md hover:scale-[1.02]'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-4 h-4 text-purple-700" />
                </div>
                <div className="text-left">
                  <span className="block leading-none">Main App</span>
                  <span className="text-[10px] font-normal opacity-80">Overview Dashboard</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </NavLink>
          </div>

          {/* Active Patient Selector (Clinician) or Profile Summary (Patient) */}
          <div className="p-3 mx-3 mt-3 bg-gradient-to-b from-purple-50/40 to-white/40 backdrop-blur-md rounded-2xl border border-purple-200/70 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-800">
                {isClinician ? 'Active Research Subject' : 'My Clinical Twin'}
              </span>
              {isClinician && (
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-100 text-purple-800 font-bold font-mono">
                  {allPatients.length} SUBJECTS
                </span>
              )}
            </div>

            {isClinician ? (
              <div className="relative">
                <select
                  value={selectedPatientId || selectedPatient?.id || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId) setSelectedPatientId(newId);
                  }}
                  className="w-full bg-white/70 backdrop-blur-md border border-purple-200 rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-600 transition-colors appearance-none cursor-pointer shadow-2xs"
                >
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.mrn})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-purple-500 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : (
              <div className="bg-white/60 backdrop-blur-md p-2 rounded-xl border border-purple-100 text-xs">
                <span className="font-bold text-slate-800 block">
                  {selectedPatient?.first_name} {selectedPatient?.last_name}
                </span>
                <span className="text-[11px] text-purple-700 font-mono">MRN: {selectedPatient?.mrn}</span>
              </div>
            )}

            {selectedPatient && (
              <div className="mt-2 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px] text-slate-600">
                <span>GA: <strong className="text-purple-700 font-mono font-bold">{gaWeeks ? `${gaWeeks.toFixed(1)}w` : 'Not recorded'}</strong></span>
                <span>Age: <strong className="text-slate-800">{selectedPatient.maternal_age}y</strong></span>
                <span>G{selectedPatient.gravidity}P{selectedPatient.parity}</span>
              </div>
            )}
          </div>

          {/* Navigation Items with smooth purple hover states */}
          <nav className="flex-1 px-3 py-3 space-y-3.5 overflow-y-auto">
            {activeNavGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-purple-800/60 block mb-1">
                  {group.title}
                </span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 group ${
                          isActive
                            ? 'bg-purple-100/80 text-purple-900 font-bold border-l-4 border-purple-700 shadow-2xs'
                            : 'text-slate-600 hover:text-purple-900 hover:bg-purple-50/70 hover:translate-x-1'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 text-purple-500 group-hover:text-purple-700 transition-colors" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {(item as any).badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold uppercase">
                          {(item as any).badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer User Info */}
          <div className="p-3 border-t border-purple-200/50 bg-white/45 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate leading-none">
                  {user?.full_name || user?.email}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span className="text-[10px] text-purple-700 capitalize font-medium">{user?.role}</span>
                </div>
              </div>
            </div>

            <NavLink
              to="/settings"
              className="p-1.5 text-slate-400 hover:text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </aside>

        {/* Main Content Area Container with Big Background Animation */}
        <div className="flex-1 relative min-w-0 flex flex-col">
          {/* 2D Purple Woman in Side Profile & Descending Origami Crane Background Animation */}
          {/* Big, located on the left where the menu screen ends, with the app on top of it */}
          <MaternalOrigamiBackground />

          {/* Main Content Viewport (Rendered ON TOP of the background animation) */}
          <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
