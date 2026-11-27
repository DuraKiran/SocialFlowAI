export type Platform =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'pinterest';

export type PostStatus =
  | 'draft'
  | 'pending'
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'published'
  | 'failed'
  | 'requires_manual_action'
  | 'waiting_approval'
  | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface SocialAccount {
  id: string;
  workspaceId: string;
  platform: Platform;
  accountName: string;
  accountType: string;
  status: 'connected' | 'disconnected' | 'expired' | 'pending_setup';
  scopes: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface MediaFile {
  id: string;
  workspaceId: string;
  title: string;
  storagePath: string;
  thumbnailDataUrl?: string;
  sizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  tags: string[];
  createdAt: string;
}

export interface ContentVariation {
  hook: string;
  caption: string;
  description: string;
  hashtags: string[];
  cta: string;
}

export interface AiGeneration {
  id: string;
  workspaceId: string;
  mediaFileId: string;
  platform: Platform;
  tone: string;
  lengthPref: string;
  language: string;
  variations: ContentVariation[];
  isTemplate: boolean;
  createdAt: string;
}

export interface Post {
  id: string;
  workspaceId: string;
  mediaFileId: string;
  socialAccountId: string | null;
  platform: Platform;
  caption: string;
  title: string;
  description: string;
  hashtags: string;
  privacy: string;
  status: PostStatus;
  publishMode: 'now' | 'scheduled';
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  externalUrl: string | null;
  idempotencyKey: string;
  lastError: string | null;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  id: string;
  workspaceId: string;
  postId: string;
  capturedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  watchTimeSeconds: number | null;
  followersGained: number | null;
}

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  plan: 'free' | 'creator' | 'pro' | 'agency';
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
}
