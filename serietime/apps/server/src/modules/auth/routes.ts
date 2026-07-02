import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { env } from '../../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    await reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) {
    await reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  request.userId = session.userId;
}

function serializeUser(user: {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  birthYear: number | null;
  gender: string | null;
  countryCode: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    birthYear: user.birthYear,
    gender: user.gender,
    countryCode: user.countryCode,
  };
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.SESSION_DURATION_DAYS * 86_400_000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/needs-setup', async () => {
    const count = await prisma.user.count();
    return { needsSetup: count === 0 };
  });

  app.post('/api/auth/setup', async (request, reply) => {
    const body = z
      .object({
        displayName: z.string().min(1).max(80),
        password: z.string().min(4).max(200),
        email: z.string().email().optional(),
      })
      .parse(request.body);

    const existing = await prisma.user.count();
    if (existing > 0) {
      return reply.code(409).send({ error: 'already_setup' });
    }
    const user = await prisma.user.create({
      data: {
        displayName: body.displayName,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        countryCode: env.DEFAULT_COUNTRY,
      },
    });
    const session = await createSession(user.id);
    return { user: serializeUser(user), token: session.token, expiresAt: session.expiresAt };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = z.object({ password: z.string() }).parse(request.body);
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!user?.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const session = await createSession(user.id);
    return { user: serializeUser(user), token: session.token, expiresAt: session.expiresAt };
  });

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (request) => {
    const header = request.headers.authorization;
    const token = header?.slice(7) ?? '';
    await prisma.session.deleteMany({ where: { token } });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return { user: serializeUser(user) };
  });

  app.post('/api/auth/password', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({ currentPassword: z.string(), newPassword: z.string().min(4).max(200) })
      .parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10) },
    });
    return { ok: true };
  });
}
