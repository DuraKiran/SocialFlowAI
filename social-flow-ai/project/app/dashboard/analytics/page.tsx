'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPosts, getMediaFiles, getSnapshots, getSocialAccounts } from '@/lib/store';
import { PLATFORM_LIST, PLATFORMS, platformName } from '@/lib/platforms';
import { generateContent } from '@/lib/ai';
import type { AiGeneration, AnalyticsSnapshot, MediaFile, Platform, Post, SocialAccount } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostStatusBadge } from '@/app/dashboard/page';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Eye, Heart, MessageCircle, Share2, Sparkles, AlertCircle, Clock, Video } from 'lucide-react';

const RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: '365', label: 'Last 365 days' },
];

export default function AnalyticsPage() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [snaps, setSnaps] = useState<AnalyticsSnapshot[]>([]);
  const [range, setRange] = useState('30');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [p, m, s, a] = await Promise.all([
        getPosts(session.workspaceId),
        getMediaFiles(session.workspaceId),
        getSnapshots(session.workspaceId),
        getSocialAccounts(session.workspaceId),
      ]);
      setPosts(p);
      setMedia(m);
      setSnaps(s);
      setAccounts(a);
      setLoading(false);
    })();
  }, [session]);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return d;
  }, [range]);

  const visible = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.status === 'published' &&
          (platformFilter === 'all' || p.platform === platformFilter) &&
          (!p.publishedAt || new Date(p.publishedAt) >= rangeStart)
      ),
    [posts, platformFilter, rangeStart]
  );

  const latestSnaps = useMemo(() => {
    // for each post, find the most recent snapshot
    const byPost = new Map<string, AnalyticsSnapshot>();
    for (const s of snaps) {
      const existing = byPost.get(s.postId);
      if (!existing || s.capturedAt > existing.capturedAt) byPost.set(s.postId, s);
    }
    return byPost;
  }, [snaps]);

  const totals = useMemo(() => {
    let views = 0, likes = 0, comments = 0, shares = 0, withData = 0;
    for (const p of visible) {
      const s = latestSnaps.get(p.id);
      if (!s) continue;
      withData++;
      views += s.views ?? 0;
      likes += s.likes ?? 0;
      comments += s.comments ?? 0;
      shares += s.shares ?? 0;
    }
    const engagement = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
    return { views, likes, comments, shares, withData, engagement, published: visible.length };
  }, [visible, latestSnaps]);

  const platformBreakdown = useMemo(() => {
    const map = new Map<Platform, { views: number; likes: number; comments: number; shares: number }>();
    for (const p of visible) {
      const s = latestSnaps.get(p.id);
      if (!s) continue;
      const cur = map.get(p.platform) ?? { views: 0, likes: 0, comments: 0, shares: 0 };
      cur.views += s.views ?? 0;
      cur.likes += s.likes ?? 0;
      cur.comments += s.comments ?? 0;
      cur.shares += s.shares ?? 0;
      map.set(p.platform, cur);
    }
    return Array.from(map.entries()).map(([platform, v]) => ({
      platform: platformName(platform),
      color: PLATFORMS[platform].color,
      ...v,
      engagement: v.views ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(1) : '0',
    }));
  }, [visible, latestSnaps]);

  const topVideos = useMemo(
    () =>
      visible
        .map((p) => {
          const s = latestSnaps.get(p.id);
          const m = media.find((mf) => mf.id === p.mediaFileId);
          const views = s?.views ?? 0;
          const likes = s?.likes ?? 0;
          const comments = s?.comments ?? 0;
          const shares = s?.shares ?? 0;
          return {
            post: p,
            title: m?.title ?? 'Video',
            thumb: m?.thumbnailDataUrl,
            views,
            likes,
            comments,
            shares,
            engagement: views ? ((likes + comments + shares) / views) * 100 : 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, 8),
    [visible, latestSnaps, media]
  );

  const insights = useMemo(() => {
    const out: string[] = [];
    if (platformBreakdown.length === 0) return out;
    const best = [...platformBreakdown].sort((a, b) => b.views - a.views)[0];
    const mostEngaging = [...platformBreakdown].sort((a, b) => Number(b.engagement) - Number(a.engagement))[0];
    out.push(`${best.platform} is your top platform by views right now (${best.views.toLocaleString()} views across tracked posts).`);
    out.push(`${mostEngaging.platform} drives the strongest engagement rate (${mostEngaging.engagement}% of viewers like, comment, or share).`);
    if (totals.published > 0 && totals.withData === 0) {
      out.push('Analytics have not been synchronized from the platforms yet — connect accounts and sync to populate performance data.');
    }
    if (totals.published >= 5) {
      out.push(`You have ${totals.published} published videos in this period. Repurpose your top performer to the platform with the lowest coverage.`);
    }
    return out;
  }, [platformBreakdown, totals]);

  const syncInfo = useMemo(() => {
    const withSync = accounts.filter((a) => a.lastSyncAt);
    if (withSync.length === 0) return 'Platforms have not been synchronized yet — analytics fill in after a sync with connected accounts.';
    const latest = withSync.sort((a, b) => (b.lastSyncAt ?? '').localeCompare(a.lastSyncAt ?? ''))[0];
    return `Last synchronization: ${new Date(latest.lastSyncAt as string).toLocaleString()} (${withSync.length} account(s)).`;
  }, [accounts]);

  const statCards = [
    { label: 'Total views', value: totals.views, icon: Eye },
    { label: 'Likes', value: totals.likes, icon: Heart },
    { label: 'Comments', value: totals.comments, icon: MessageCircle },
    { label: 'Shares', value: totals.shares, icon: Share2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Video Analytics</h1>
          <p className="text-sm text-slate-400">{syncInfo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-40 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORM_LIST.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Sparkles className="h-8 w-8 animate-pulse text-cyan-500" /></div>
      ) : visible.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-slate-600" />
            <p className="text-slate-300">No published videos in this period.</p>
            <p className="max-w-md text-sm text-slate-500">
              Publish videos and synchronize analytics to see performance here. Metrics come only from real platform data — nothing is estimated.
            </p>
            <Button asChild variant="outline" className="border-slate-700 hover:bg-slate-800">
              <Link href="/dashboard/publish">Publish a video</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map((c) => (
              <Card key={c.label} className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <c.icon className="h-3.5 w-3.5 text-cyan-400" /> {c.label}
                  </div>
                  <div className="mt-1 text-2xl font-bold">{c.value.toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Video className="h-3.5 w-3.5 text-cyan-400" /> Published
                </div>
                <div className="mt-1 text-2xl font-bold">{totals.published}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader className="pb-2"><CardTitle className="text-base">Views by platform</CardTitle></CardHeader>
              <CardContent>
                {platformBreakdown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">No synchronized analytics data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={platformBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="platform" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                      <Bar dataKey="views" radius={4}>
                        {platformBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader className="pb-2"><CardTitle className="text-base">Engagement by platform</CardTitle></CardHeader>
              <CardContent>
                {platformBreakdown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">No synchronized analytics data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={platformBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="platform" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                      <Bar dataKey="likes" name="Likes" stackId="a" fill="#06b6d4" radius={0} />
                      <Bar dataKey="comments" name="Comments" stackId="a" fill="#10b981" radius={0} />
                      <Bar dataKey="shares" name="Shares" stackId="a" fill="#f59e0b" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Top performing videos</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-800">
                  {topVideos.map((v, i) => (
                    <div key={v.post.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-sm font-semibold text-slate-500">{i + 1}</span>
                      <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-slate-800">
                        {v.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumb} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{v.title}</div>
                        <div className="text-xs text-slate-500">
                          {platformName(v.post.platform)} · {v.views.toLocaleString()} views · {v.engagement.toFixed(1)}% engagement
                        </div>
                      </div>
                      <PostStatusBadge status={v.post.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-cyan-500/5 border-cyan-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-cyan-400" /> AI Performance Analyst
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.length === 0 ? (
                  <p className="text-sm text-slate-500">Insights appear once multiple platforms have published videos with synced data.</p>
                ) : (
                  insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" /> {ins}
                    </div>
                  ))
                )}
                <p className="border-t border-slate-800 pt-3 text-xs text-slate-500">
                  Observations are based on collected analytics only. Predictions are clearly labeled and never presented as facts.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
