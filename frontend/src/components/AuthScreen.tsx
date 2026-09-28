'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/lib/auth';

export default function AuthScreen({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && name.trim().length < 2) {
      setError('Add your name so collaborators know who is typing.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setPending(true);
    try {
      if (mode === 'register') await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-paper">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-10%] h-[420px] w-[420px] rounded-full bg-[#3a2a16]/70 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[480px] w-[480px] rounded-full bg-[#1d2a28]/80 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
        <section className="hidden lg:block">
          <p className="text-xs font-medium tracking-[0.28em] text-saffron uppercase">SyncFlow</p>
          <h1 className="mt-6 max-w-xl font-serif text-6xl leading-[0.95] text-paper">
            The same sentence, on two screens, at once.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-mist">
            A collaborative page with live cursors, a share link, and nothing else shouting for attention.
          </p>
          <div className="relative mt-12 h-56 max-w-md">
            <div className="absolute top-6 left-8 h-44 w-72 rotate-[-6deg] rounded-2xl bg-[#2a241c] shadow-2xl" />
            <div className="absolute top-0 left-0 h-48 w-80 rounded-2xl bg-paper p-6 text-ink shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
              <p className="font-serif text-2xl">Monday notes</p>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded bg-line" />
                <div className="h-2 w-5/6 rounded bg-line" />
                <div className="relative h-2 w-2/3 rounded bg-line">
                  <span className="absolute -top-3 right-6 h-6 w-px bg-[#2f5d50]" />
                  <span className="absolute -top-1 right-0 rounded-full bg-[#9a4d24] px-1.5 py-0.5 text-[10px] text-white">Asha</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <p className="mb-4 text-xs font-medium tracking-[0.28em] text-saffron uppercase lg:hidden">SyncFlow</p>
          <div className="rounded-[28px] bg-paper px-6 py-7 text-ink shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8">
            <h2 className="font-serif text-4xl leading-none">
              {mode === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="mt-2 text-sm text-[#6f675d]">
              {mode === 'login' ? 'Sign in to your pages.' : 'Start a workspace in a few seconds.'}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[#efe8dc] p-1 text-sm">
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setMode(item); setError(''); }}
                  className={`rounded-full px-3 py-2 transition ${mode === item ? 'bg-ink text-paper' : 'text-[#6f675d]'}`}
                >
                  {item === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[#6f675d]">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 outline-none focus:border-ink"
                    placeholder="Lovjyot Singh"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block text-[#6f675d]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 outline-none focus:border-ink"
                  placeholder="you@studio.com"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[#6f675d]">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 pr-16 outline-none focus:border-ink"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[#6f675d]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-xl bg-[#fde8e2] px-3 py-2 text-sm text-clay" role="alert">{error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-ink py-3 text-sm font-medium text-paper transition hover:bg-ink-2 disabled:opacity-60"
              >
                {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-center text-xs text-mist">Built by Lovjyot Singh</p>
        </section>
      </div>
    </main>
  );
}
