import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { APIProvider } from './contexts/APIContext';
import { CaseProvider } from './contexts/CaseContext';
import './App.css';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Pages - Dashboard & Cases
import Dashboard from './pages/Dashboard';
import CaseIntake from './pages/cases/CaseIntake';
import CaseIntakeChat from './pages/cases/CaseIntakeChat';
import CaseList from './pages/cases/CaseList';
import CaseDetail from './pages/cases/CaseDetail';

// Pages - Visualizations
import BuildingSimulation from './pages/visualizations/BuildingSimulation';
import OfficeSimulation from './pages/visualizations/OfficeSimulation';
import GraphMesh from './pages/visualizations/GraphMesh';
import OrchestratorView from './pages/visualizations/OrchestratorView';

// Pages - Analysis
import CaseDossier from './pages/analysis/CaseDossier';

// Pages - What-If & Judge
import WhatIfMode from './pages/whatif/WhatIfMode';
import HearingPack from './pages/judge/HearingPack';
import KnowledgeBase from './pages/judge/KnowledgeBase';

// Pages - Senior Judge
import SeniorJudgeInbox from './pages/senior/SeniorJudgeInbox';

// Pages - Admin
import DomainManagement from './pages/admin/DomainManagement';

import NotFound from './pages/NotFound';

// Layout
import ProtectedRoute from './components/auth/ProtectedRoute';
import RootLayout from './components/layout/RootLayout';
import SessionWarning from './components/shared/SessionWarning';
import GlobalNotification from './components/shared/GlobalNotification';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ConnectivityIndicator from './components/shared/ConnectivityIndicator';

/**
 * RootApp - Entry point with all providers and routing
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <APIProvider>
            <CaseProvider>
              <SessionWarning />
              <GlobalNotification />
              <ConnectivityIndicator />
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected routes with shared layout */}
                <Route element={<RootLayout />}>
                  <Route
                    path="/"
                    element={<ProtectedRoute allowedRoles={['judge', 'admin']} element={<Dashboard />} />}
                  />
                  <Route
                    path="/cases/intake"
                    element={<ProtectedRoute allowedRoles={['judge', 'admin']} element={<CaseIntake />} />}
                  />
                  <Route
                    path="/cases/intake/:caseId/confirm"
                    element={<ProtectedRoute allowedRoles={['judge', 'admin']} element={<CaseIntakeChat />} />}
                  />
                  <Route
                    path="/cases"
                    element={<ProtectedRoute allowedRoles={['judge', 'admin']} element={<CaseList />} />}
                  />

                  {/* Case Detail with nested routes */}
                  <Route
                    path="/case/:caseId"
                    element={<ProtectedRoute allowedRoles={['judge', 'admin']} element={<CaseDetail />} />}
                  >
                    <Route path="building" element={<OfficeSimulation />} />
                    <Route path="building/grid" element={<BuildingSimulation />} />
                    <Route path="graph" element={<GraphMesh />} />
                    <Route path="dossier" element={<CaseDossier />} />
                    <Route path="what-if" element={<WhatIfMode />} />
                    <Route path="hearing-pack" element={<HearingPack />} />
                    <Route path="orchestrator" element={<OrchestratorView />} />
                    <Route index element={<Navigate to="building" replace />} />
                  </Route>

                  <Route
                    path="/knowledge-base"
                    element={<ProtectedRoute allowedRoles={['judge']} element={<KnowledgeBase />} />}
                  />
                  <Route
                    path="/senior-inbox"
                    element={<ProtectedRoute allowedRoles={['senior_judge', 'admin']} element={<SeniorJudgeInbox />} />}
                  />
                  <Route
                    path="/admin/domains"
                    element={<ProtectedRoute allowedRoles={['admin']} element={<DomainManagement />} />}
                  />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CaseProvider>
          </APIProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
