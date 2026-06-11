// Phase 3 D-14 — TelegramOutbound implementation.
//
// sendQuoteKeyboard: client lookup → lead lookup → city names (best-effort) →
//   bot.api.sendMessage with reply_markup + parse_mode HTML.
// sendText:           client lookup → sendMessage. Used by Wave 5 manager intercept.
//
// Both methods are SILENT-skip when client.telegramId is null (D-26): a voice-only
// client has no Telegram identity to send to. The caller (intake.ts) has its own
// log for any debug; this layer does NOT throw or signal — proactive sends must
// not corrupt the inbound FSM.
import { sql } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { Db } from '../../db.js';
import { clientsRepo, leadsRepo } from '../../persistence/repos/index.js';
import type { OutboundChannel } from '../../pipeline/outbound.js';
import { formatQuoteMessage, quoteKeyboard } from './keyboards.js';

export function createTelegramOutbound(deps: { db: Db; bot: Bot }): OutboundChannel {
  return {
    async sendQuoteKeyboard({ clientId, leadId, quotedPriceKop, lang }) {
      const client = await clientsRepo.findById(deps.db, clientId);
      if (!client?.telegramId) return; // D-26 — skip silently.
      const lead = await leadsRepo.findById(deps.db, leadId);
      if (!lead) return;

      // Best-effort city name lookup. NULL fromCityId/toCityId → empty result.
      const cityIds = [lead.fromCityId, lead.toCityId].filter(
        (id): id is string => typeof id === 'string'
      );
      const cityNames = new Map<string, string>();
      if (cityIds.length > 0) {
        // Drizzle's sql`${array}` expands a JS array as a record `(a,b)`, which
        // postgres rejects when cast to uuid[]. Pass as a single JSON array
        // parameter and unnest via ARRAY constructor with ::uuid[] cast.
        const cityRows = await deps.db.execute(sql`
          SELECT id::text AS id,
                 CASE WHEN ${lang} = 'ua' THEN name_ua ELSE name_ru END AS name
          FROM cities
          WHERE id::text = ANY(${cityIds}::text[])
        `);
        for (const r of cityRows.rows as Array<{ id: string; name: string }>) {
          cityNames.set(r.id, r.name);
        }
      }

      const text = formatQuoteMessage({
        lead: { fromCityId: lead.fromCityId, toCityId: lead.toCityId, tons: lead.tons },
        quotedPriceKop,
        lang,
        fromCityName: lead.fromCityId ? cityNames.get(lead.fromCityId) : undefined,
        toCityName: lead.toCityId ? cityNames.get(lead.toCityId) : undefined,
      });
      await deps.bot.api.sendMessage(client.telegramId, text, {
        reply_markup: quoteKeyboard(leadId, lang),
        parse_mode: 'HTML',
      });
    },
    async sendText({ clientId, text }) {
      const client = await clientsRepo.findById(deps.db, clientId);
      if (!client?.telegramId) return;
      await deps.bot.api.sendMessage(client.telegramId, text);
    },
  };
}
