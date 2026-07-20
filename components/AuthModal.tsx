'use client';

import React, { useState } from 'react';

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: { token: string; user: { id: string; username: string } }) => void;
};

export default function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const cleanUser = username.trim().toLowerCase();
      if (mode === 'signup' && !/^[a-z0-9_]{3,24}$/.test(cleanUser)) {
        setError('Username must be 3-24 chars: letters, numbers, underscore only');
        setLoading(false);
        return;
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password,
          ...(mode === 'signup' && email ? { email: email.trim() } : {}),
        }),
      });

      let data: { error?: string; token?: string; user?: { id: string; username: string } } = {};
      try {
        data = await res.json();
      } catch {
        setError(
          res.status === 500 || res.status === 503
            ? 'Server error during signup. Often missing JWT_SECRET on Vercel — add it and redeploy.'
            : `Request failed (${res.status}). Try again.`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }
      if (!data.token || !data.user) {
        setError('Invalid server response. Try again.');
        return;
      }
      onSuccess(data as { token: string; user: { id: string; username: string } });
      onClose();
      setUsername('');
      setEmail('');
      setPassword('');
    } catch {
      setError('Network error. Check connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setForgotSuccess(false);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });
      if (res.ok) {
        setForgotSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send reset email');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-3xl tracking-tight">{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>

        {mode === 'forgot' ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-white/70">Enter your username and we'll email a reset link (if you provided an email on signup).</p>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-[var(--gold)]"
                required
                autoComplete="username"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {forgotSuccess && <p className="text-sm text-green-400">If an account exists with an email, a reset link was sent.</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full rounded-2xl py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setForgotSuccess(false); setError(''); }} className="mt-2 w-full text-sm text-white/60 hover:text-white">Back to login</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-[var(--gold)]"
                required
                autoComplete="username"
              />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Email (for password resets & receipts)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-[var(--gold)]"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-[var(--gold)]"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full rounded-2xl py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}

        {mode !== 'forgot' && (
          <>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="mt-2 w-full text-center text-xs text-white/50 hover:text-white"
              >
                Forgot password?
              </button>
            )}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setEmail('');
              }}
              className="mt-4 w-full text-center text-sm text-white/60 hover:text-white"
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}