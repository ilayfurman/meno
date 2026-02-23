import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../config/env.js';

async function resolveInternalUser(clerkUserId: string, email?: string, name?: string) {
  const existing = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (existing[0]) {
    await db
      .update(users)
      .set({
        lastSeenAt: new Date(),
        email: email ?? existing[0].email,
        name: name ?? existing[0].name,
      })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  const inserted = await db
    .insert(users)
    .values({
      clerkUserId,
      email: email ?? null,
      name: name ?? null,
      lastSeenAt: new Date(),
    })
    .returning({ id: users.id });

  return inserted[0]!.id;
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    if (!env.CLERK_SECRET_KEY) {
      return reply.code(500).send({ error: 'CLERK_SECRET_KEY is required for bearer auth.' });
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });
      const clerkUserId = payload.sub;
      if (!clerkUserId) {
        return reply.code(401).send({ error: 'Invalid auth token: missing subject' });
      }

      const userId = await resolveInternalUser(clerkUserId, payload.email as string | undefined, undefined);
      request.auth = { userId, clerkUserId };
      return;
    } catch {
      return reply.code(401).send({ error: 'Invalid auth token' });
    }
  }

  if (env.ALLOW_DEV_AUTH) {
    const clerkUserId =
      (request.headers['x-dev-clerk-user-id'] as string | undefined) ?? env.DEV_FALLBACK_CLERK_USER_ID;
    const userId = await resolveInternalUser(clerkUserId);
    request.auth = { userId, clerkUserId };
    return;
  }

  return reply.code(401).send({ error: 'Unauthorized' });
}
