import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import Settings from './pages/Settings';
import System from './pages/System';
import LeavingSoon from './pages/LeavingSoon';
import SetupWizard from './components/SetupWizard';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { LoadingSpinner } from './components/LoadingSpinner';
import { setup } from './api';

function App() {
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(true); // Default to true to avoid flash

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await setup.status();
      setSetupComplete(response.data.setupComplete);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      // If we can't check, assume setup is complete to show the app
      setSetupComplete(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setSetupComplete(true);
  };

  // Show loading spinner while checking setup status
  if (loading) {
    return (
      <div className="min-h-screen main-content flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Show setup wizard if setup is not complete
  if (!setupComplete) {
    return (
      <ToastProvider>
        <SetupWizard onComplete={handleSetupComplete} />
        <ToastContainer />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rules" element={<Rules />} />
          <Route path="leaving-soon" element={<LeavingSoon />} />
          {/* Settings routes - consolidated under /settings */}
          <Route path="settings" element={<Settings />} />
          <Route path="settings/storage" element={<Settings section="storage" />} />
          <Route path="settings/path-mappings" element={<Settings section="path-mappings" />} />
          <Route path="settings/cleanup" element={<Settings section="cleanup" />} />
          <Route path="settings/notifications" element={<Settings section="notifications" />} />
          <Route path="settings/general" element={<Settings section="general" />} />
          <Route path="settings/ui" element={<Settings section="ui" />} />
          <Route path="system" element={<System />} />
        </Route>
      </Routes>
      <ToastContainer />
    </ToastProvider>
  );
}

export default App;
