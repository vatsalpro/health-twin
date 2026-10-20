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
  UserCheck,
  ChevronDown,
  Upload,
  AlertTriangle,
  Menu,
  X,
  Stethoscope,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, selectedPatient, allPatients, setSelectedPatientId, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#070B14] text-[#F4F7FC] flex flex-col md:flex-row grid-bg">
      {/* Top Header on Mobile */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[rgba(166,190,220,0.14)] bg-[#0B1220]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#5BE7E8] to-[#628BFF] flex items-center justify-center font-bold text-[#070B14]">
            PT
          </div>
          <span className="font-bold tracking-tight text-lg text-[#F4F7FC]">PregTwin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#A5B3C8] hover:text-[#F4F7FC]"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Navigation Rail */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col w-full md:w-64 border-r border-[rgba(166,190,220,0.14)] bg-[#0B1220]/95 backdrop-blur-xl shrink-0 z-40 transition-all`}
      >
        {/* Brand */}
        <div className="p-6 border-b border-[rgba(166,190,220,0.1)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5BE7E8] via-[#43D6B0] to-[#628BFF] flex items-center justify-center font-bold text-[#070B14] shadow-lg shadow-[#5BE7E8]/10">
            PT
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-[#F4F7FC] leading-none">PregTwin</h1>
            <p className="text-[11px] font-mono text-[#5BE7E8] mt-1 tracking-wider uppercase">
              Maternal Digital Twin
            </p>
          </div>
        </div>

        {/* Patient Context Switcher */}
        <div className="p-4 border-b border-[rgba(166,190,220,0.1)]">
          <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
            Active Research Subject
          </label>
          <div className="relative">
            <select
              value={selectedPatient?.id || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-[#101A2B] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC] focus:outline-none focus:border-[#5BE7E8] transition-colors appearance-none cursor-pointer"
            >
              {allPatients.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#101A2B] text-[#F4F7FC]">
                  {p.first_name} {p.last_name} ({p.mrn})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#A5B3C8] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {selectedPatient && (
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#A5B3C8]">
              <span>GA: <strong className="text-[#5BE7E8] font-mono">{selectedPatient.episodes[0]?.current_gestational_age_weeks || 28.0}w</strong></span>
              <span>Age: <strong className="text-[#F4F7FC]">{selectedPatient.maternal_age}y</strong></span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#5BE7E8]/10 text-[#5BE7E8] font-mono">
                SYNTHETIC
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavLink
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Maternal Dashboard</span>
          </NavLink>

          <NavLink
            to="/maternal-twin"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <Dna className="w-4 h-4" />
            <span>Living Maternal Twin (3D)</span>
          </NavLink>

          <NavLink
            to="/pregnancy-timeline"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <Clock className="w-4 h-4" />
            <span>Pregnancy Timeline</span>
          </NavLink>

          <NavLink
            to="/medical-records"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <FileText className="w-4 h-4" />
            <span>Medical Reports & OCR</span>
          </NavLink>

          <NavLink
            to="/observations"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Observations & Trends</span>
          </NavLink>

          <NavLink
            to="/risk-forecast"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <TrendingUp className="w-4 h-4" />
            <span>Preeclampsia Risk Forecast</span>
          </NavLink>

          <NavLink
            to="/simulation-lab"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <FlaskConical className="w-4 h-4" />
            <span>Simulation Lab</span>
          </NavLink>

          {/* Clinician Specific Routes */}
          {isClinician && (
            <>
              <div className="pt-3 pb-1">
                <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#E9B96E]">
                  Clinician Workspace
                </span>
              </div>

              <NavLink
                to="/clinician/review-queue"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#E9B96E]/20 text-[#E9B96E] border border-[#E9B96E]/40 shadow-sm'
                      : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
                  }`
                }
              >
                <ClipboardList className="w-4 h-4" />
                <span>Clinical Review Queue</span>
              </NavLink>

              <NavLink
                to="/audit-history"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                      : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
                  }`
                }
              >
                <History className="w-4 h-4" />
                <span>Audit History</span>
              </NavLink>
            </>
          )}

          <div className="pt-3 pb-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#A5B3C8]">
              Configuration
            </span>
          </div>

          <NavLink
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC] hover:bg-[#101A2B]/60'
              }`
            }
          >
            <Settings className="w-4 h-4" />
            <span>Diagnostics & AI Setup</span>
          </NavLink>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-[rgba(166,190,220,0.1)] bg-[#070B14]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#142137] border border-[rgba(166,190,220,0.2)] flex items-center justify-center text-xs text-[#5BE7E8] font-bold">
                {user?.full_name ? user.full_name[0] : 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-[#F4F7FC] truncate">{user?.full_name || 'Guest'}</p>
                <p className="text-[10px] text-[#A5B3C8] capitalize">{user?.role || 'User'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-[#A5B3C8] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Synthetic Data Alert Banner */}
        <div className="bg-[#101A2B]/90 border-b border-[rgba(166,190,220,0.14)] px-6 py-2 flex items-center justify-between text-xs text-[#A5B3C8] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E9B96E]" />
            <span>
              <strong>Research Demonstration Mode:</strong> All patient records and reports are synthetic fixtures. Not an autonomous medical diagnostic device.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
            <span>Model: v1.4.2-calibrated</span>
            <span className="text-[#43D6B0]">● System Ready</span>
          </div>
        </div>

        <div className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
