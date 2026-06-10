// apps/web/scripts/gen-admin-password.ts
// D-66 — bcryptjs hash generator for ADMIN_PASSWORD_HASH env var.
// Run via: pnpm --filter @ai-logist/web gen:admin-password
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';

const rl = createInterface({ input: stdin, output: stdout, terminal: true });
const password = await rl.question('Admin password: ');
rl.close();

if (!password || password.length < 4) {
  console.error('Password too short (min 4 chars)');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(`\nADMIN_PASSWORD_HASH=${hash}\n`);
process.exit(0);
