import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../auth/routes.js';
import { fromJson, toJson } from '../../utils/json.js';

const DEFAULT_SETTINGS = {
  titlesInUserLanguage: true,
  commentLanguages: ['fr', 'en'],
  notifications: { newEpisode: true, newMovie: true, importDone: true },
  theme: 'light' as 'system' | 'light' | 'dark',
  autoplayTrailers: false,
  upcoming: { hideWatched: false, channels: [] as string[] },
  subscriptions: [] as string[],
  appLock: false,
};

export type AppSettings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: 'app' } });
  return { ...DEFAULT_SETTINGS, ...fromJson<Partial<AppSettings>>(row?.valueJson, {}) };
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/settings', async () => {
    return { settings: await getSettings() };
  });

  app.post('/api/settings', async (request) => {
    const patch = z.record(z.unknown()).parse(request.body);
    const current = await getSettings();
    const next = { ...current, ...patch };
    await prisma.appSetting.upsert({
      where: { key: 'app' },
      create: { key: 'app', valueJson: toJson(next) },
      update: { valueJson: toJson(next) },
    });
    return { settings: next };
  });

  app.post('/api/cache/clear', async () => {
    const { count } = await prisma.apiCache.deleteMany({});
    return { ok: true, cleared: count };
  });

  app.get('/api/notifications', async (request) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.userId },
      orderBy: { date: 'desc' },
      take: 100,
    });
    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        imageUrl: n.imageUrl,
        date: n.date.toISOString(),
        isRead: n.isRead,
      })),
    };
  });

  app.post('/api/notifications/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.notification.updateMany({
      where: { id, userId: request.userId },
      data: { isRead: true },
    });
    return { ok: true };
  });
}
