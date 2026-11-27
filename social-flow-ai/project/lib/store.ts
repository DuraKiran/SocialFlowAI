'use client';

import type {
  AiGeneration,
  AnalyticsSnapshot,
  MediaFile,
  Notification,
  Post,
  Session,
  SocialAccount,
  Subscription,
  User,
  Workspace,
  Platform,
  PostStatus,
  ContentVariation,
} from './types';
import { getRecord, getAll, getByIndex, putRecord, deleteRecord, uuid } from './db';

function nowIso() {
  return new Date().toISOString();
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const users = await getAll<User>('users');
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists. Try signing in instead.');
  }
  const salt = uuid();
  const passwordHash = await hashPassword(password, salt);
  const user: User = { id: uuid(), email, name, passwordHash, salt, createdAt: nowIso() };
  await putRecord('users', user);
  return user;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signIn(email: string, password: string): Promise<Session> {
  const users = await getAll<User>('users');
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('No account found with that email.');
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('Incorrect password.');
  const ws = await ensureWorkspace(user);
  return { userId: user.id, email: user.email, name: user.name, workspaceId: ws.id };
}

export async function ensureWorkspace(user: User): Promise<Workspace> {
  const all = await getAll<Workspace>('workspaces');
  const existing = all.find((w) => w.ownerId === user.id);
  if (existing) return existing;
  const ws: Workspace = {
    id: uuid(),
    name: `${user.name.split(' ')[0]}'s Workspace`,
    ownerId: user.id,
    createdAt: nowIso(),
  };
  await putRecord('workspaces', ws);
  await putRecord('team_members', {
    id: uuid(),
    workspaceId: ws.id,
    userId: user.id,
    role: 'owner',
    createdAt: nowIso(),
  });
  await putRecord('subscriptions', {
    id: uuid(),
    workspaceId: ws.id,
    plan: 'free',
    currentPeriodEnd: null,
    createdAt: nowIso(),
  } as Subscription);
  return ws;
}

// ---- social accounts ----
export function getSocialAccounts(workspaceId: string) {
  return getByIndex<SocialAccount>('social_accounts', 'workspaceId', workspaceId);
}

export function upsertSocialAccount(account: SocialAccount) {
  return putRecord('social_accounts', account);
}

export async function removeSocialAccount(id: string) {
  return deleteRecord('social_accounts', id);
}

export async function connectAccount(
  workspaceId: string,
  platform: Platform,
  accountName: string
): Promise<SocialAccount> {
  const account: SocialAccount = {
    id: uuid(),
    workspaceId,
    platform,
    accountName,
    accountType: 'account',
    status: 'pending_setup',
    scopes: 'read, publish (pending OAuth credentials)',
    connectedAt: nowIso(),
    lastSyncAt: null,
    createdAt: nowIso(),
  };
  await putRecord('social_accounts', account);
  return account;
}

// ---- media ----
export function getMediaFiles(workspaceId: string) {
  return getByIndex<MediaFile>('media_files', 'workspaceId', workspaceId);
}

export function getMediaFile(id: string) {
  return getRecord<MediaFile>('media_files', id);
}

export function saveMediaFile(media: MediaFile) {
  return putRecord('media_files', media);
}

export async function removeMediaFile(id: string) {
  const posts = (await getAll<Post>('posts')).filter((p) => p.mediaFileId === id);
  for (const p of posts) await deleteRecord('posts', p.id);
  const gens = (await getAll<AiGeneration>('ai_generations')).filter((g) => g.mediaFileId === id);
  for (const g of gens) await deleteRecord('ai_generations', g.id);
  return deleteRecord('media_files', id);
}

// ---- ai ----
export function getGenerationsForMedia(mediaFileId: string) {
  return getByIndex<AiGeneration>('ai_generations', 'mediaFileId', mediaFileId);
}

export function saveGeneration(gen: AiGeneration) {
  return putRecord('ai_generations', gen);
}

export async function saveVariation(
  workspaceId: string,
  mediaFileId: string,
  platform: Platform,
  tone: string,
  lengthPref: string,
  language: string,
  variation: ContentVariation
) {
  const existing = (await getGenerationsForMedia(mediaFileId)).find(
    (g) => g.platform === platform
  );
  if (existing) {
    existing.variations = [variation, ...existing.variations];
    return putRecord('ai_generations', existing);
  }
  return putRecord('ai_generations', {
    id: uuid(),
    workspaceId,
    mediaFileId,
    platform,
    tone,
    lengthPref,
    language,
    variations: [variation],
    isTemplate: false,
    createdAt: nowIso(),
  } as AiGeneration);
}

// ---- posts ----
export function getPosts(workspaceId: string) {
  return getByIndex<Post>('posts', 'workspaceId', workspaceId);
}

export function getPost(id: string) {
  return getRecord<Post>('posts', id);
}

export function savePost(post: Post) {
  return putRecord('posts', post);
}

export async function removePost(id: string) {
  const snaps = (await getAll<AnalyticsSnapshot>('analytics_snapshots')).filter(
    (s) => s.postId === id
  );
  for (const s of snaps) await deleteRecord('analytics_snapshots', s.id);
  return deleteRecord('posts', id);
}

export async function retryPost(post: Post): Promise<Post> {
  post.status = 'pending';
  post.lastError = null;
  post.idempotencyKey = uuid();
  await putRecord('posts', post);
  return runPublish(post.id);
}

export async function runPublish(postId: string): Promise<Post> {
  const post = await getRecord<Post>('posts', postId);
  if (!post) throw new Error('Post not found.');
  const media = await getMediaFile(post.mediaFileId);
  const account = post.socialAccountId
    ? await getRecord<SocialAccount>('social_accounts', post.socialAccountId)
    : undefined;

  if (!media) {
    post.status = 'failed';
    post.lastError = 'Source video is missing from the media library.';
    await putRecord('posts', post);
    return post;
  }
  if (!account || account.status !== 'connected') {
    post.status = 'requires_manual_action';
    post.lastError =
      'This platform account is not connected with live publishing credentials. OAuth approval from the platform is required before posting is possible — see Connected Accounts.';
    await putRecord('posts', post);
    return post;
  }
  if (account.status === 'connected' && !account.scopes.includes('live')) {
    post.status = 'requires_manual_action';
    post.lastError =
      'The connected account is in setup mode. Once platform OAuth credentials are configured, publishing runs automatically.';
    await putRecord('posts', post);
    return post;
  }

  post.status = 'published';
  post.publishedAt = nowIso();
  post.externalPostId = `ext_${post.idempotencyKey.slice(0, 8)}`;
  post.externalUrl = null;
  await putRecord('posts', post);
  return post;
}

// ---- analytics ----
export function getSnapshots(workspaceId: string) {
  return getByIndex<AnalyticsSnapshot>('analytics_snapshots', 'workspaceId', workspaceId);
}

export function saveSnapshot(snap: AnalyticsSnapshot) {
  return putRecord('analytics_snapshots', snap);
}

// ---- notifications ----
export function getNotifications(userId: string) {
  return getByIndex<Notification>('notifications', 'userId', userId);
}

export async function notify(
  workspaceId: string,
  userId: string,
  type: string,
  title: string,
  body: string
) {
  return putRecord('notifications', {
    id: uuid(),
    workspaceId,
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: nowIso(),
  } as Notification);
}

export async function markAllRead(userId: string) {
  const items = await getNotifications(userId);
  for (const n of items) {
    if (!n.read) {
      n.read = true;
      await putRecord('notifications', n);
    }
  }
}

export async function markRead(id: string) {
  const n = await getRecord<Notification>('notifications', id);
  if (n) {
    n.read = true;
    await putRecord('notifications', n);
  }
}

// ---- subscriptions ----
export async function getSubscription(workspaceId: string): Promise<Subscription | undefined> {
  const all = (await getAll<Subscription>('subscriptions')).filter(
    (s) => s.workspaceId === workspaceId
  );
  return all[0];
}

export async function setPlan(workspaceId: string, plan: Subscription['plan']) {
  const sub = await getSubscription(workspaceId);
  if (sub) {
    sub.plan = plan;
    await putRecord('subscriptions', sub);
  }
}

export function statusLabel(status: PostStatus): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
