import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Stethoscope
} from 'lucide-react';
import { Badge } from './ui/Badge';

export const Layout: React.FC = () => {
  const { user, selectedPatient, allPatients, setSelectedPatientId, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  // Role-specific navigation groups
  const clinicianNavGroups = [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard', label: 'Clinical Dashboard', icon: LayoutDashboard },
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

  const activeEpisode = selectedPatient?.episodes[0];
  const gaWeeks = activeEpisode?.current_gestational_age_weeks;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row grid-bg">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-xs">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-slate-900">PregTwin</span>
            <span className="text-[10px] text-sky-700 block -mt-0.5 font-medium">Maternal Research Platform</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-72' : 'hidden'
        } md:flex flex-col w-full md:w-64 border-r border-slate-200 bg-white shrink-0 md:sticky md:top-0 md:h-screen transition-all shadow-xs`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-xs">
              <HeartPulse className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-slate-900 leading-none">PregTwin</h1>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                Maternal Health Twin Lab
              </p>
            </div>
          </div>
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Patient Selection & Summary */}
        <div className="p-3 mx-3 mt-3 bg-slate-50 rounded-xl border border-slate-200/90">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {isClinician ? 'Active Research Subject' : 'My Clinical Profile'}
            </span>
            {isClinician && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-100 text-sky-800 font-semibold font-mono">
                {allPatients.length} SUBJECTS
              </span>
            )}
          </div>

          {isClinician ? (
            <div className="relative">
              <select
                value={selectedPatient?.id || ''}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 transition-colors appearance-none cursor-pointer shadow-2xs"
              >
                {allPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.mrn})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          ) : (
            <div className="bg-white p-2 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block">
                {selectedPatient?.first_name} {selectedPatient?.last_name}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">MRN: {selectedPatient?.mrn}</span>
            </div>
          )}

          {selectedPatient && (
            <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-600">
              <span>GA: <strong className="text-sky-700 font-mono font-semibold">{gaWeeks ? `${gaWeeks.toFixed(1)}w` : 'Not recorded'}</strong></span>
              <span>Age: <strong className="text-slate-800">{selectedPatient.maternal_age}y</strong></span>
              <span>G{selectedPatient.gravidity}P{selectedPatient.parity}</span>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-3 space-y-3.5 overflow-y-auto">
          {activeNavGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
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
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-sky-50 text-sky-800 font-semibold border-l-3 border-sky-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {(item as any).badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase">
                        {(item as any).badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer User Info & Settings */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
              {user?.full_name ? user.full_name[0] : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 truncate leading-none">
                {user?.full_name || user?.email}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isClinician ? 'bg-amber-500' : 'bg-sky-500'}`} />
                <span className="text-[10px] text-slate-500 capitalize">{user?.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NavLink
              to="/settings"
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </NavLink>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};
