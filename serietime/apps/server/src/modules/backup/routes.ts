import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../auth/routes.js';
import { APP_VERSION } from '../../config/env.js';

// Export/restauration JSON des données utilisateur (spec §14.10, §37).
export async function backupRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/api/backup/export', async (request) => {
    const userId = request.userId;
    const [user, media, shows, seasons, episodes, mediaStatuses, episodeStatuses, watchEvents, lists, listItems] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.media.findMany(),
        prisma.show.findMany(),
        prisma.season.findMany(),
        prisma.episode.findMany(),
        prisma.userMediaStatus.findMany({ where: { userId } }),
        prisma.userEpisodeStatus.findMany({ where: { userId } }),
        prisma.watchEvent.findMany({ where: { userId } }),
        prisma.mediaList.findMany({ where: { userId } }),
        prisma.listItem.findMany({ where: { list: { userId } } }),
      ]);
    return {
      app: 'SerieTime',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { user, media, shows, seasons, episodes, mediaStatuses, episodeStatuses, watchEvents, lists, listItems },
    };
  });

  app.post('/api/backup/import', async (request, reply) => {
    const body = z
      .object({
        app: z.literal('SerieTime'),
        version: z.string(),
        data: z.object({
          media: z.array(z.record(z.unknown())),
          shows: z.array(z.record(z.unknown())),
          seasons: z.array(z.record(z.unknown())),
          episodes: z.array(z.record(z.unknown())),
          mediaStatuses: z.array(z.record(z.unknown())),
          episodeStatuses: z.array(z.record(z.unknown())),
          watchEvents: z.array(z.record(z.unknown())).default([]),
          lists: z.array(z.record(z.unknown())).default([]),
          listItems: z.array(z.record(z.unknown())).default([]),
        }),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_backup', details: body.error.issues });

    const userId = request.userId;
    const d = body.data.data;
    const restore = async <T extends { id?: unknown }>(
      rows: Record<string, unknown>[],
      upsert: (row: Record<string, unknown>) => Promise<T | void>,
    ) => {
      for (const row of rows) {
        try {
          await upsert(row);
        } catch {
          // ligne corrompue : ignorée, la restauration continue
        }
      }
    };

    const dateFields = new Set([
      'createdAt', 'updatedAt', 'firstAirDate', 'releaseDate', 'lastSyncedAt', 'airDate',
      'addedAt', 'startedAt', 'completedAt', 'lastWatchedAt', 'watchedAt', 'eventDate',
      'nextEpisodeAirDate', 'lastEpisodeAirDate', 'fetchedAt', 'expiresAt', 'date',
    ]);
    const revive = (row: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === 'string' && dateFields.has(k) ? new Date(v) : v;
      }
      return out;
    };

    await restore(d.media, (r) => {
      const row = revive(r) as never;
      return prisma.media.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.shows, (r) => {
      const row = revive(r) as never;
      return prisma.show.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.seasons, (r) => {
      const row = revive(r) as never;
      return prisma.season.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.episodes, (r) => {
      const row = revive(r) as never;
      return prisma.episode.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.mediaStatuses, (r) => {
      const row = { ...revive(r), userId } as never;
      return prisma.userMediaStatus.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.episodeStatuses, (r) => {
      const row = { ...revive(r), userId } as never;
      return prisma.userEpisodeStatus.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.lists, (r) => {
      const row = { ...revive(r), userId } as never;
      return prisma.mediaList.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.listItems, (r) => {
      const row = revive(r) as never;
      return prisma.listItem.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });
    await restore(d.watchEvents, (r) => {
      const row = { ...revive(r), userId } as never;
      return prisma.watchEvent.upsert({ where: { id: String(r['id']) }, create: row, update: row });
    });

    return { ok: true };
  });
}
