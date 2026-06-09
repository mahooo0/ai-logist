// D-07 — repos barrel.
//
// Namespace re-export keeps call sites grep-friendly:
//   import { trucksRepo } from '@/persistence/repos';
//   await trucksRepo.findById(db, id);
//
// Each repo file exports a flat set of pure functions taking Db as first arg;
// no classes, no DI container.

export * as citiesRepo from './cities.js';
export * as clientsRepo from './clients.js';
export * as leadEventsRepo from './lead_events.js';
export * as leadsRepo from './leads.js';
export * as messagesRepo from './messages.js';
export * as ordersRepo from './orders.js';
export * as trucksRepo from './trucks.js';
