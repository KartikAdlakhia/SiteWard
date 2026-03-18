import React, { useState } from 'react';
import { supabase } from '../api';

export function Auth({ onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUP, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (isSignUP) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage('Check your email for the confirmation link!');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.session) {
          onSession(data.session);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark font-display flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3 text-primary mb-6">
          <div className="size-10 flex items-center justify-center bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary text-3xl">shield_with_heart</span>
          </div>
          <h2 className="text-text-main text-3xl font-black leading-tight tracking-tight">SiteWard</h2>
        </div>
        <h2 className="mt-2 text-center text-xl font-bold text-text-main">
          {isSignUP ? 'Create a new account' : 'Sign in to your account'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-dark py-8 px-4 shadow-sm border border-border-dark sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label className="block text-sm font-medium text-text-muted">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-border-dark rounded-lg placeholder-text-muted focus:outline-none focus:ring-primary focus:border-primary bg-background-light text-text-main sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-border-dark rounded-lg placeholder-text-muted focus:outline-none focus:ring-primary focus:border-primary bg-background-light text-text-main sm:text-sm transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 p-4 border border-rose-200">
                <div className="text-sm text-rose-700">{error}</div>
              </div>
            )}

            {message && (
              <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                <div className="text-sm text-emerald-700">{message}</div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : (isSignUP ? 'Sign Up' : 'Sign In')}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-dark" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-dark text-text-muted">
                  Or
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUP)}
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {isSignUP ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
