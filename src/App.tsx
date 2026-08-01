/**
 * App.tsx — SGMS React Router
 *
 * FIX 1: Added missing /print-reports and /import-export routes.
 * FIX 2: Added public /scan-pair route — the second device opens this
 *         after scanning the session QR from QRPairing. No auth needed.
 * NEW: Wrapped in ThemeProvider for the multi-theme system.
 */
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from 'sonner';

// Pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Students from '@/pages/Students';
import Activities from '@/pages/Activities';
import ScoreEntry from '@/pages/ScoreEntry';
import Reports from '@/pages/Reports';
import PrintReports from '@/pages/PrintReports';
import Settings from '@/pages/Settings';
import QRGenerate from '@/pages/QRGenerate';
import QRPairing from '@/pages/QRPairing';
import QRScanPair from '@/pages/QRScanPair';
import AuditLog from '@/pages/AuditLog';
import ImportExport from '@/pages/ImportExport';

// Layout
import Layout from '@/components/Layout';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* PUBLIC route — second device scans session QR and lands here */}
      <Route path="/scan-pair" element={<QRScanPair />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="activities" element={<Activities />} />
        <Route path="scores" element={<ScoreEntry />} />
        <Route path="reports" element={<Reports />} />
        <Route path="print-reports" element={<PrintReports />} />
        <Route path="qr-generate" element={<QRGenerate />} />
        <Route path="qr-pairing" element={<QRPairing />} />
        <Route path="import-export" element={<ImportExport />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
