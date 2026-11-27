'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getPosts, getMediaFiles, getSocialAccounts, savePost, removePost } from '@/lib/store';
import { PLATFORM_LIST, PLATFORMS, platformName } from '@/lib/platforms';
import type { MediaFile, Platform, Post, SocialAccount } from '@/lib/types';
import { PostStatusBadge } from '@/app/dashboard/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statusLabel } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/media';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  ListFilter,
  Trash2,
  Video,
} from 'lucide-react';

type View = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const [p, m] = await Promise.all([getPosts(session.workspaceId), getMediaFiles(session.workspaceId)]);
    setPosts(p);
    setMedia(m);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function reschedule(postId: string, newDate: Date) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.status === 'published') {
      toast({ title: 'Cannot reschedule', description: 'This post is already published.', variant: 'destructive' });
      return;
    }
    // keep the original time of day, move only the date
    const old = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const when = new Date(newDate);
    when.setHours(old.getHours(), old.getMinutes(), 0, 0);
    post.scheduledAt = when.toISOString();
    post.status = 'pending';
    post.publishMode = 'scheduled';
    await savePost(post);
    await refresh();
    toast({ title: 'Rescheduled', description: `Moved to ${when.toLocaleString()}` });
  }

  const filtered = useMemo(
    () => posts.filter((p) => platformFilter === 'all' || p.platform === platformFilter),
    [posts, platformFilter]
  );

  const scheduled = useMemo(
    () =>
      filtered
        .filter((p) => p.scheduledAt)
        .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    [filtered]
  );

  function shiftCursor(dir: number) {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  }

  const monthCells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];
    const start = new Date(y, m, 1 - startDay);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === m });
    }
    return cells;
  }, [cursor]);

  const weekCells = useMemo(() => {
    const d = new Date(cursor);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      return cell;
    });
  }, [cursor]);

  const postsOn = useCallback(
    (date: Date) =>
      scheduled.filter((p) => {
        const d = new Date(p.scheduledAt ?? p.createdAt);
        return (
          d.getFullYear() === date.getFullYear() &&
          d.getMonth() === date.getMonth() &&
          d.getDate() === date.getDate()
        );
      }),
    [scheduled]
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm text-slate-400">Drag scheduled posts between days to reschedule.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-40 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORM_LIST.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={view} onValueChange={(v) => setView(v as View)}>
            <SelectTrigger className="w-28 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-700" onClick={() => shiftCursor(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 border-slate-700" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-700" onClick={() => shiftCursor(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Calendar className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-300">
          {view === 'month'
            ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            : view === 'week'
              ? `Week of ${weekCells[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : 'Upcoming'}
        </span>
        <span>·</span>
        <span>{scheduled.length} scheduled post(s)</span>
      </div>

      {view === 'list' ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-0">
            {scheduled.length === 0 ? (
              <p className="py-14 text-center text-sm text-slate-500">Nothing scheduled. Use the Bulk Scheduler to plan a batch.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {scheduled.map((p) => {
                  const m = media.find((mf) => mf.id === p.mediaFileId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3">
                      <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-slate-800">
                        {m?.thumbnailDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m?.title ?? 'Video'}</div>
                        <div className="text-xs text-slate-500">
                          {platformName(p.platform)} · {new Date(p.scheduledAt ?? '').toLocaleString()}
                        </div>
                      </div>
                      <PostStatusBadge status={p.status} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={async () => { await removePost(p.id); await refresh(); toast({ title: 'Removed' }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-slate-900/80 px-2 py-1.5 text-center text-xs font-medium text-slate-400">{d}</div>
          ))}
          {(view === 'month' ? monthCells : weekCells.map((d) => ({ date: d, inMonth: true }))).map((cell, i) => {
            const items = postsOn(cell.date);
            const isToday = cell.date.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[92px] bg-slate-950/60 p-1.5 transition-colors',
                  !cell.inMonth && view === 'month' && 'opacity-40',
                  isToday && 'bg-cyan-500/5 ring-1 ring-inset ring-cyan-500/40'
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) void reschedule(dragId, cell.date);
                  setDragId(null);
                }}
              >
                <div className={cn('mb-1 text-right text-xs', isToday ? 'font-bold text-cyan-300' : 'text-slate-500')}>
                  {cell.date.getDate()}
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((p) => {
                    const m = media.find((mf) => mf.id === p.mediaFileId);
                    return (
                      <button
                        key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        className="flex w-full items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:border-cyan-500/40"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PLATFORMS[p.platform].color }} />
                        <span className="truncate text-slate-300">{m?.title ?? 'Video'}</span>
                        <span className="ml-auto shrink-0 text-slate-500">
                          {new Date(p.scheduledAt ?? '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    );
                  })}
                  {items.length > 3 && <div className="px-1 text-[10px] text-slate-500">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
