'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { KeyRound, Mail, User, ShieldCheck, Eye, EyeOff } from 'lucide-react';

// Password strength calculator
function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: 'transparent', barColor: 'transparent' };

  let score = 0;

  // Length checks
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { level: 1, label: 'Weak', color: '#ef4444', barColor: '#ef4444' };           // Red
  } else if (score <= 4) {
    return { level: 2, label: 'Medium', color: '#eab308', barColor: '#eab308' };          // Yellow
  } else {
    return { level: 3, label: 'Strong', color: '#22c55e', barColor: '#22c55e' };          // Green
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth, hydrateAuth, isHydrated } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isHydrated && token) {
      router.push('/');
    }
  }, [isHydrated, token, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Confirm password validation (only on register)
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Password strength gate (only on register)
    if (!isLogin && passwordStrength.level < 1) {
      setError('Please enter a stronger password.');
      return;
    }

    setLoading(true);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Guard against non-JSON responses (e.g. HTML error pages)
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response. Please try again.');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setAuth(data.token, data.user);
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Password mismatch helper
  const showMismatch = !isLogin && confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Background neon glows */}
      <div className="glow-indigo -top-20 -left-20"></div>
      <div className="glow-teal -bottom-20 -right-20"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-premium relative z-10">
        {/* App Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-teal-400 flex items-center justify-center mb-3 shadow-indigo">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-white to-teal-200 bg-clip-text text-transparent">
            CoSphere
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Real-Time Workspace & Analytics</p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${!isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm glass-input"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm glass-input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm glass-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Indicator — only on register */}
            {!isLogin && password.length > 0 && (
              <div className="pt-2 space-y-1.5">
                {/* Strength Bar */}
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((segment) => (
                    <div
                      key={segment}
                      className="h-1.5 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor:
                          passwordStrength.level >= segment
                            ? passwordStrength.barColor
                            : 'rgba(255,255,255,0.07)',
                      }}
                    />
                  ))}
                </div>
                {/* Label */}
                <p
                  className="text-xs font-semibold transition-colors duration-300"
                  style={{ color: passwordStrength.color }}
                >
                  {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password — only on register */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg text-sm glass-input transition-colors ${showMismatch ? 'border border-red-500/50' : ''
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {showMismatch && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
              {!isLogin && confirmPassword.length > 0 && password === confirmPassword && (
                <p className="text-xs text-green-400 mt-1">Passwords match ✓</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition shadow-indigo/20 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Get Started'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
