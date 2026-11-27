'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Video, Sparkles, BarChart3, Calendar, UploadCloud, ArrowRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  {
    icon: UploadCloud,
    title: 'Bulk Upload & Scheduling',
    body: 'Upload 20–50 videos at once, generate platform-specific content for each, and let the smart scheduler distribute them across optimal time slots.',
  },
  {
    icon: Sparkles,
    title: 'AI Content Studio',
    body: 'Generate hooks, captions, titles, descriptions, and hashtags tuned for each platform — YouTube, Instagram, TikTok, Facebook, LinkedIn, X, and Pinterest.',
  },
  {
    icon: Video,
    title: 'One-Click Multi-Platform Publishing',
    body: 'One video, every platform. Each destination gets its own caption, title, hashtags, and publishing job — tracked independently.',
  },
  {
    icon: BarChart3,
    title: 'Video Analytics',
    body: 'Views, engagement, and watch time across platforms, with cross-platform comparison and top-performing video rankings.',
  },
  {
    icon: Calendar,
    title: 'Content Calendar',
    body: 'See every scheduled and published post in one place, with monthly, weekly, daily, and list views.',
  },
  {
    icon: Zap,
    title: 'Publishing History',
    body: 'Every publishing job with live status, detailed errors when a platform fails, and safe retry that never double-posts.',
  },
];

const STEPS = [
  { n: 1, title: 'Upload', body: 'Drag in one video or fifty. Duration, resolution, and thumbnails are detected automatically.' },
  { n: 2, title: 'Generate', body: 'AI writes platform-native captions, titles, and hashtags. Edit anything before it goes out.' },
  { n: 3, title: 'Schedule', body: 'Publish now, pick a time, or auto-distribute across days and time slots.' },
  { n: 4, title: 'Track', body: 'Watch performance roll in from every platform in one analytics dashboard.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <span className="font-semibold">SocialFlow AI</span>
          </div>
          <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
            <Badge variant="outline" className="mb-6 border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              AI-powered multi-platform publishing
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Upload once.{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Publish everywhere.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              SocialFlow AI turns one video into platform-native posts for YouTube, Instagram,
              TikTok, Facebook, LinkedIn, X, and Pinterest — with bulk scheduling for up to 50
              videos and analytics that show what actually works.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/auth">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800">
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              {['No credit card required', 'Free plan included', 'Your data stays yours'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800/60 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-cyan-500/40 hover:bg-slate-900">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <f.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800/60 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold">How it works</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="relative">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 font-semibold text-cyan-300">
                    {s.n}
                  </div>
                  <h3 className="mb-2 font-semibold">{s.title}</h3>
                  <p className="text-sm text-slate-400">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/60 py-8 text-center text-sm text-slate-600">
        SocialFlow AI — publish everywhere from one place.
      </footer>
    </div>
  );
}
