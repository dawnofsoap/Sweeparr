import { useState } from 'react';
import { setup } from '../api';

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    instanceName: 'Sweeparr',
    authentication: 'forms',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validateStep1 = () => {
    if (!form.instanceName.trim()) {
      setError('Instance name is required');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (form.authentication !== 'none') {
      if (!form.username.trim()) {
        setError('Username is required');
        return false;
      }
      if (!form.password) {
        setError('Password is required');
        return false;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      handleComplete();
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);

    try {
      await setup.complete({
        instanceName: form.instanceName,
        authentication: form.authentication,
        username: form.authentication !== 'none' ? form.username : undefined,
        password: form.authentication !== 'none' ? form.password : undefined,
      });

      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete setup');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center main-content">
      <div className="card rounded-lg shadow-2xl w-full max-w-lg p-8 m-4">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🧹</div>
          <h1 className="text-2xl font-bold">Welcome to Sweeparr</h1>
          <p className="text-gray-400 mt-2">Let's get you set up</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s < step
                    ? 'bg-green-600 text-white'
                    : s === step
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    s < step ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Instance Name */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Instance Configuration</h2>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Instance Name
              </label>
              <input
                type="text"
                value={form.instanceName}
                onChange={(e) => setForm({ ...form, instanceName: e.target.value })}
                className="input w-full"
                placeholder="Sweeparr"
                autoFocus
              />
              <p className="text-sm text-gray-400 mt-2">
                This name will be shown in the UI and notifications.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Authentication */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
              
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Authentication
              </label>
              <select
                value={form.authentication}
                onChange={(e) => setForm({ ...form, authentication: e.target.value })}
                className="input w-full mb-4"
              >
                <option value="forms">Forms Authentication (Web Native)</option>
                <option value="basic">Basic Authentication (Browser)</option>
                <option value="none">None (Not Recommended)</option>
              </select>

              {form.authentication === 'none' && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 text-yellow-200 text-sm mb-4">
                  ⚠️ Running without authentication is not recommended. Anyone with access to this URL can control Sweeparr.
                </div>
              )}

              {form.authentication !== 'none' && (
                <>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="input w-full mb-4"
                    placeholder="admin"
                  />

                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input w-full mb-4"
                    placeholder="••••••••"
                  />

                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="input w-full"
                    placeholder="••••••••"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-lg font-semibold">Setup Complete!</h2>
            <p className="text-gray-400">
              Your Sweeparr instance is ready to use.
            </p>

            <div className="text-sm text-gray-400">
              <p>Next steps:</p>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>Add your media server (Jellyfin/Emby)</li>
                <li>Connect your *arr apps (Radarr/Sonarr)</li>
                <li>Create cleanup rules</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          {step > 1 && step < 3 ? (
            <button onClick={handleBack} className="btn btn-secondary">
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Setting up...' : step === 2 ? 'Complete Setup' : 'Next'}
            </button>
          ) : (
            <button onClick={handleFinish} className="btn btn-primary">
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetupWizard;
