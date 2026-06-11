// Phase 6 D-15 / Pitfall 6 — minimal admin authentication.
//
// Backend currently has NO authentication (Phase 4 left this for v2). Phase 6
// introduces admin override endpoints which we tag with a shared-secret check
// when ADMIN_API_SECRET is set in env. When the env is UNSET, requireAdmin is
// a no-op — dev/staging keeps working without ceremony.

import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const adminAuthPlugin = fp(async (app) => {
  app.decorate(
    'requireAdmin',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const expected = config.ADMIN_API_SECRET;
      if (!expected) return; // no-op when secret unset (dev/demo convenience)
      const got = req.headers['x-admin-secret'];
      if (typeof got !== 'string' || got !== expected) {
        reply.code(401).send({ error: 'unauthorized' });
        return reply as unknown as void;
      }
    }
  );
});
