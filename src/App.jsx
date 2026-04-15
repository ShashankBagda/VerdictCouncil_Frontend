import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { APIProvider } from './contexts/APIContext';
import { CaseProvider } from './contexts/CaseContext';
import { useAuth } from './hooks';
import './App.css';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';

// Pages - Dashboard & Cases
import Dashboard from './pages/Dashboard';
import CaseIntake from './pages/cases/CaseIntake';
import CaseList from './pages/cases/CaseList';
import CaseDetail from './pages/cases/CaseDetail';

// Pages - Visualizations
import BuildingSimulation from './pages/visualizations/BuildingSimulation';
import GraphMesh from './pages/visualizations/GraphMesh';

// Pages - Analysis
import CaseDossier from './pages/analysis/CaseDossier';

// Pages - What-If & Judge
import WhatIfMode from './pages/whatif/WhatIfMode';
import HearingPack from './pages/judge/HearingPack';
import KnowledgeBase from './pages/judge/KnowledgeBase';

// Pages - Escalation
import EscalatedCases from './pages/escalation/EscalatedCases';
import NotFound from './pages/NotFound';

// Layout
import RootLayout from './components/layout/RootLayout';
import SessionWarning from './components/shared/SessionWarning';
import GlobalNotification from './components/shared/GlobalNotification';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ConnectivityIndicator from './components/shared/ConnectivityIndicator';

/**
 * ProtectedRoute - Only render if authenticated
 */
function ProtectedRoute({ element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? element : <Navigate to="/login" replace />;
}

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

                {/* Protected routes with shared layout */}
                <Route element={<RootLayout />}>
                  <Route
                    path="/"
                    element={<ProtectedRoute element={<Dashboard />} />}
                  />
                  <Route
                    path="/cases/intake"
                    element={<ProtectedRoute element={<CaseIntake />} />}
                  />
                  <Route
                    path="/cases"
                    element={<ProtectedRoute element={<CaseList />} />}
                  />

                  {/* Case Detail with nested routes */}
                  <Route
                    path="/case/:caseId"
                    element={<ProtectedRoute element={<CaseDetail />} />}
                  >
                    <Route path="building" element={<BuildingSimulation />} />
                    <Route path="graph" element={<GraphMesh />} />
                    <Route path="dossier" element={<CaseDossier />} />
                    <Route path="what-if" element={<WhatIfMode />} />
                    <Route path="hearing-pack" element={<HearingPack />} />
                    <Route index element={<Navigate to="building" replace />} />
                  </Route>

                  <Route
                    path="/knowledge-base"
                    element={<ProtectedRoute element={<KnowledgeBase />} />}
                  />
                  <Route
                    path="/escalated-cases"
                    element={<ProtectedRoute element={<EscalatedCases />} />}
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
