
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy loading pages to optimize bundle size and initial load time
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Distribution = lazy(() => import('./pages/Distribution'));
const Entry = lazy(() => import('./pages/Entry'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800"></div>
      <p className="text-sm text-slate-500 font-medium">Carregando...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/distribution" element={<Distribution />} />
            <Route path="/entry" element={<Entry />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
