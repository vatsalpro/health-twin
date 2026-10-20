import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { MaternalTwinView } from './views/MaternalTwinView';
import { PregnancyTimelineView } from './views/PregnancyTimelineView';
import { MedicalRecordsView } from './views/MedicalRecordsView';
import { DocumentDetailView } from './views/DocumentDetailView';
import { ObservationsView } from './views/ObservationsView';
import { RiskForecastView } from './views/RiskForecastView';
import { SimulationLabView } from './views/SimulationLabView';
import { ClinicianReviewQueueView } from './views/ClinicianReviewQueueView';
import { AuditHistoryView } from './views/AuditHistoryView';
import { SettingsView } from './views/SettingsView';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireClinician?: boolean }> = ({
  children,
  requireClinician = false,
}) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#5BE7E8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireClinician && user?.role !== 'clinician' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="maternal-twin" element={<MaternalTwinView />} />
            <Route path="pregnancy-timeline" element={<PregnancyTimelineView />} />
            <Route path="medical-records" element={<MedicalRecordsView />} />
            <Route path="medical-records/:documentId" element={<DocumentDetailView />} />
            <Route path="observations" element={<ObservationsView />} />
            <Route path="risk-forecast" element={<RiskForecastView />} />
            <Route path="simulation-lab" element={<SimulationLabView />} />

            {/* Clinician Workspace */}
            <Route
              path="clinician/review-queue"
              element={
                <ProtectedRoute requireClinician>
                  <ClinicianReviewQueueView />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-history"
              element={
                <ProtectedRoute requireClinician>
                  <AuditHistoryView />
                </ProtectedRoute>
              }
            />

            <Route path="settings" element={<SettingsView />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
