import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


// Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

// Context
import { AuthProvider } from '@/context/AuthContext';

// Layout
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

// Auth pages
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';

// App pages
import Dashboard from '@/pages/dashboard/Dashboard';
import CaseList from '@/pages/cases/CaseList';
import CaseDetail from '@/pages/cases/CaseDetail';
import NewCase from '@/pages/cases/NewCase';
import EvidenceUpload from '@/pages/evidence/EvidenceUpload';
import EvidenceDetail from '@/pages/evidence/EvidenceDetail';

// OSINT & Threat Intel
import OsintDashboard from '@/pages/osint/OsintDashboard';
import LiveThreatIntelligence from '@/pages/threat/LiveThreatIntelligence';
import ThreatInvestigate from '@/pages/threat/ThreatInvestigate';

// Findings module (fully implemented)
import FindingsList from '@/pages/findings/FindingsList';
import FindingDetail from '@/pages/findings/FindingDetail';
import FindingForm from '@/pages/findings/FindingForm';


// Risk Assessment module
import RiskList from '@/pages/risk_assessments/RiskList';
import RiskForm from '@/pages/risk_assessments/RiskForm';
import RiskDetail from '@/pages/risk_assessments/RiskDetail';

// Reports module
import ReportList from '@/pages/reports/ReportList';
import ReportWizard from '@/pages/reports/ReportWizard';
import ReportDetail from '@/pages/reports/ReportDetail';

import ComplaintIntelligence from '@/pages/intelligence/ComplaintIntelligence';
import ImageAuthenticity from '@/pages/intelligence/ImageAuthenticity';

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Cases */}
                <Route path="/cases" element={<CaseList />} />
                <Route path="/cases/new" element={<NewCase />} />
                <Route path="/cases/:id" element={<CaseDetail />} />

                {/* Evidence */}
                <Route path="/evidence" element={<EvidenceUpload />} />
                <Route path="/evidence/upload" element={<EvidenceUpload />} />
                <Route path="/evidence/:id" element={<EvidenceDetail />} />

                {/* OSINT & Threat Intel */}
                <Route path="/complaint-ai" element={<ComplaintIntelligence />} />
                <Route path="/image-auth" element={<ImageAuthenticity />} />
                <Route path="/osint" element={<OsintDashboard />} />
                <Route path="/threat-intelligence" element={<LiveThreatIntelligence />} />
                <Route path="/threat-intelligence/investigate" element={<ThreatInvestigate />} />

                {/* Findings */}
                <Route path="/findings" element={<FindingsList />} />
                <Route path="/findings/new" element={<FindingForm mode="create" />} />
                <Route path="/findings/:id" element={<FindingDetail />} />

                {/* Risk Assessments */}
                <Route path="/risk" element={<RiskList />} />
                <Route path="/risk/new" element={<RiskForm mode="create" />} />
                <Route path="/risk/:id" element={<RiskDetail />} />

                {/* Reports */}
                <Route path="/reports" element={<ReportList />} />
                <Route path="/reports/new" element={<ReportWizard />} />
                <Route path="/reports/:id" element={<ReportDetail />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>

    </QueryClientProvider>
  );
}

export default App;
