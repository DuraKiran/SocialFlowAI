'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { workspaceStats, workspaceName } from '@/lib/workspace';
import { getMediaFiles, getPosts } from '@/lib/store';
import { platformName } from '@/lib/platforms';
import type { MediaFile, Post } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/lib/store';
import { formatDuration } from '@/lib/media';
import {
  UploadCloud,
  Files,
  Send,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Video,
} from 'lucide-react';

export default function OverviewPage() {
  const { session } = useAuth();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof workspaceStats>> | null>(null);
  const [wsName, setWsName] = useState('');
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      const [s, n, posts, mediaFiles] = await Promise.all([
        workspaceStats(session.workspaceId),
        workspaceName(session.workspaceId),
        getPosts(session.workspaceId),
        getMediaFiles(session.workspaceId),
      ]);
      if (!active) return;
      setStats(s);
      setWsName(n);
      setRecentPosts(
        posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
      );
      setMedia(mediaFiles);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const cards = [
    { label: 'Videos in library', value: stats?.mediaCount ?? 0, icon: Video, href: '/dashboard/library' },
    { label: 'Published', value: stats?.published ?? 0, icon: CheckCircle2, href: '/dashboard/posts' },
    { label: 'Scheduled', value: stats?.scheduled ?? 0, icon: CalendarClock, href: '/dashboard/calendar' },
    { label: 'Needs attention', value: stats?.failed ?? 0, icon: AlertTriangle, href: '/dashboard/posts' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-slate-400">{wsName ? `${wsName} · ` : ''}Here is where your content stands.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            <Link href="/dashboard/publish">
              <UploadCloud className="mr-2 h-4 w-4" /> Publish a video
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
            <Link href="/dashboard/ai-studio">
              <Sparkles className="mr-2 h-4 w-4" /> AI Studio
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="border-slate-800 bg-slate-900/50 transition-colors hover:border-cyan-500/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <c.icon className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-slate-500">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent publishing activity</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
              <Link href="/dashboard/posts">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Send className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">No publishing jobs yet.</p>
                <Button asChild size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800">
                  <Link href="/dashboard/publish">Create your first post</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPosts.map((p) => {
                  const m = media.find((mf) => mf.id === p.mediaFileId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-slate-800">
                        {m?.thumbnailDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m?.title ?? 'Video'}</div>
                        <div className="text-xs text-slate-500">
                          {platformName(p.platform)} · {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <PostStatusBadge status={p.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: '/dashboard/bulk-upload', icon: Files, label: 'Bulk upload videos', desc: 'Up to 50 at once' },
              { href: '/dashboard/scheduler', icon: CalendarClock, label: 'Bulk scheduler', desc: 'Auto-distribute posts' },
              { href: '/dashboard/accounts', icon: Send, label: 'Connect accounts', desc: 'Link social platforms' },
              { href: '/dashboard/analytics', icon: Sparkles, label: 'Analytics', desc: 'See what performs' },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 transition-colors hover:border-cyan-500/40"
              >
                <a.icon className="h-4 w-4 text-cyan-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-slate-500">{a.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-600" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PostStatusBadge({ status }: { status: Post['status'] }) {
  const map: Record<string, string> = {
    published: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    failed: 'border-red-500/40 bg-red-500/10 text-red-300',
    requires_manual_action: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    waiting_approval: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    pending: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    draft: 'border-slate-600 bg-slate-800 text-slate-300',
    cancelled: 'border-slate-600 bg-slate-800 text-slate-400',
  };
  return (
    <Badge variant="outline" className={map[status] ?? 'border-blue-500/40 bg-blue-500/10 text-blue-300'}>
      {statusLabel(status)}
    </Badge>
  );
}
