'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { KeyRound, Mail, User, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (token) {
      router.push('/');
    }
  }, [token, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              !isLogin ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
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
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm glass-input"
              />
            </div>
          </div>

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
