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

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Patient Data',
      items: [
        { to: '/medical-records', label: 'Medical Records', icon: FileText },
        { to: '/measurements-devices', label: 'Measurements & Sensors', icon: Cpu },
        { to: '/observations', label: 'Observations & Trends', icon: Activity },
        { to: '/pregnancy-timeline', label: 'Pregnancy Timeline', icon: Clock },
      ],
    },
    {
      title: 'Digital Twin',
      items: [
        { to: '/maternal-twin', label: 'Maternal Twin (3D)', icon: Dna },
        { to: '/risk-forecast', label: 'Risk Research', icon: TrendingUp },
        { to: '/simulation-lab', label: 'Simulation Lab', icon: FlaskConical },
      ],
    },
    {
      title: 'Research Tools',
      items: [
        { to: '/camera-research', label: 'Camera Signal Research', icon: Camera },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row grid-bg">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-sm">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-slate-900">PregTwin</span>
            <span className="text-[10px] text-sky-700 block -mt-0.5 font-medium">Research Platform</span>
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

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'block fixed inset-0 z-50' : 'hidden'
        } md:flex flex-col w-full md:w-64 border-r border-slate-200 bg-white shrink-0 md:sticky md:top-0 md:h-screen transition-all shadow-sm`}
      >
        {/* Mobile close overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Navigation</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-sm">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 leading-none">PregTwin</h1>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Maternal Digital Twin Lab
            </p>
          </div>
        </div>

        {/* Patient Selection & Summary */}
        <div className="p-3.5 mx-3 mt-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <label className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block mb-1">
            Active Research Subject
          </label>
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
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {selectedPatient && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
              <span>GA: <strong className="text-sky-700 font-mono font-semibold">{selectedPatient.episodes[0]?.current_gestational_age_weeks ? `${selectedPatient.episodes[0]?.current_gestational_age_weeks}w` : 'Not recorded'}</strong></span>
              <span>Age: <strong className="text-slate-800">{selectedPatient.maternal_age}y</strong></span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-700 font-medium font-mono">
                COHORT
              </span>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
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
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-sky-50 text-sky-800 font-semibold border-l-3 border-sky-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Clinician Specific Workspace */}
          {isClinician && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-amber-700 block mb-1">
                Clinician Workspace
              </span>
              <NavLink
                to="/clinician/review-queue"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 font-semibold border-l-3 border-amber-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <ClipboardList className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Review Queue</span>
              </NavLink>
              <NavLink
                to="/audit-history"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 font-semibold border-l-3 border-amber-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <History className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Audit History</span>
              </NavLink>
            </div>
          )}
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
              <span className="text-[10px] text-slate-500 capitalize">{user?.role}</span>
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
