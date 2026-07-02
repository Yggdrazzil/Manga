import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { requireAuth } from '../auth/routes.js';
import { serializeEpisode } from '../media/serialize.js';
import { markEpisodeUnwatched, markEpisodeWatched } from '../media/actions.js';

export async function episodeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/api/episodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { show: { include: { media: true } } },
    });
    if (!episode) return reply.code(404).send({ error: 'not_found' });
    const status = await prisma.userEpisodeStatus.findUnique({
      where: { userId_episodeId: { userId: request.userId, episodeId: id } },
    });
    return {
      episode: serializeEpisode(
        episode,
        episode.show,
        episode.show.media.localizedTitle ?? episode.show.media.title,
        status,
      ),
      backdropPath: episode.stillPath ?? episode.show.media.backdropPath,
      rating: status?.rating ?? null,
      personalNote: status?.personalNote ?? null,
    };
  });

  app.post('/api/episodes/:id/watched', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ watchedAt: z.string().datetime().optional() }).parse(request.body ?? {});
    const exists = await prisma.episode.findUnique({ where: { id } });
    if (!exists) return reply.code(404).send({ error: 'not_found' });
    await markEpisodeWatched(request.userId, id, body.watchedAt ? new Date(body.watchedAt) : new Date());
    return { ok: true };
  });

  app.post('/api/episodes/:id/unwatched', async (request, reply) => {
    const { id } = request.params as { id: string };
    const exists = await prisma.episode.findUnique({ where: { id } });
    if (!exists) return reply.code(404).send({ error: 'not_found' });
    await markEpisodeUnwatched(request.userId, id);
    return { ok: true };
  });

  app.post('/api/episodes/:id/rating', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ rating: z.number().min(0).max(10).nullable() }).parse(request.body);
    const episode = await prisma.episode.findUnique({ where: { id }, include: { show: true } });
    if (!episode) return reply.code(404).send({ error: 'not_found' });
    await prisma.userEpisodeStatus.upsert({
      where: { userId_episodeId: { userId: request.userId, episodeId: id } },
      create: { userId: request.userId, episodeId: id, status: 'unwatched', rating: body.rating },
      update: { rating: body.rating },
    });
    if (body.rating !== null) {
      await prisma.watchEvent.create({
        data: {
          userId: request.userId,
          mediaId: episode.show.mediaId,
          episodeId: id,
          eventType: 'rated',
          eventDate: new Date(),
          source: 'app',
        },
      });
    }
    return { ok: true };
  });

  app.post('/api/episodes/:id/date', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ watchedAt: z.string() }).parse(request.body);
    const date = new Date(body.watchedAt);
    if (Number.isNaN(date.getTime())) return reply.code(400).send({ error: 'invalid_date' });
    const exists = await prisma.episode.findUnique({ where: { id } });
    if (!exists) return reply.code(404).send({ error: 'not_found' });
    await prisma.userEpisodeStatus.upsert({
      where: { userId_episodeId: { userId: request.userId, episodeId: id } },
      create: { userId: request.userId, episodeId: id, status: 'watched', watchedAt: date },
      update: { watchedAt: date },
    });
    return { ok: true };
  });
}
