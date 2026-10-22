import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransitionProvider, useAppTransition } from './context/TransitionContext';
import { CraneDeliveryTransition } from './components/CraneDeliveryTransition';
import { Layout } from './components/Layout';
import { FrontWelcomeView } from './views/FrontWelcomeView';
import { DashboardView } from './views/DashboardView';
import { MaternalTwinView } from './views/MaternalTwinView';
import { PregnancyTimelineView } from './views/PregnancyTimelineView';
import { MedicalRecordsView } from './views/MedicalRecordsView';
import { DocumentDetailView } from './views/DocumentDetailView';
import { ObservationsView } from './views/ObservationsView';
import { RiskForecastView } from './views/RiskForecastView';
import { SimulationLabView } from './views/SimulationLabView';
import { DevicesAndMeasurementsView } from './views/DevicesAndMeasurementsView';
import { CameraSignalResearchView } from './views/CameraSignalResearchView';
import { ClinicianReviewQueueView } from './views/ClinicianReviewQueueView';
import { AuditHistoryView } from './views/AuditHistoryView';
import { SettingsView } from './views/SettingsView';
import { AIAssistantView } from './views/AIAssistantView';
import { MedicationsView } from './views/MedicationsView';
import { AppointmentsView } from './views/AppointmentsView';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireClinician?: boolean }> = ({
  children,
  requireClinician = false,
}) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/welcome" replace />;
  }

  if (requireClinician && user?.role !== 'clinician' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Root route handler: always loads the Front Welcome Screen first
const RootEntryRoute: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-3 border-purple-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Welcome screen comes first on app load
  return <FrontWelcomeView />;
};

const AppRoutes: React.FC = () => {
  const { isTransitioning, onMidpointAction, endTransition } = useAppTransition();

  return (
    <>
      <Routes>
        {/* Front Welcome Screen (Says PregTwin, pregnant women imagery, login options) */}
        <Route path="/" element={<RootEntryRoute />} />
        <Route path="/welcome" element={<FrontWelcomeView />} />
        <Route path="/login" element={<FrontWelcomeView />} />

        {/* Main App Workspace (Layout with TopBar & Medial Left Side Nav) */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="ai-assistant" element={<AIAssistantView />} />
          <Route path="medications" element={<MedicationsView />} />
          <Route path="appointments" element={<AppointmentsView />} />
          <Route path="maternal-twin" element={<MaternalTwinView />} />
          <Route path="pregnancy-timeline" element={<PregnancyTimelineView />} />
          <Route path="medical-records" element={<MedicalRecordsView />} />
          <Route path="medical-records/:documentId" element={<DocumentDetailView />} />
          <Route path="observations" element={<ObservationsView />} />
          <Route path="measurements-devices" element={<DevicesAndMeasurementsView />} />
          <Route path="camera-research" element={<CameraSignalResearchView />} />
          <Route path="risk-forecast" element={<RiskForecastView />} />
          <Route path="simulation-lab" element={<SimulationLabView />} />
          <Route path="simulation" element={<Navigate to="/simulation-lab" replace />} />

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Transition Overlay: Large 2D silhouette crane flock across screen, purple blanket, then fades from middle */}
      {isTransitioning && (
        <CraneDeliveryTransition
          onMidpoint={() => {
            if (onMidpointAction) onMidpointAction();
          }}
          onComplete={endTransition}
        />
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TransitionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TransitionProvider>
    </AuthProvider>
  );
};

export default App;
