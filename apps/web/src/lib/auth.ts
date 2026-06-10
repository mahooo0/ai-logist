// apps/web/src/lib/auth.ts
// jose-signed session cookie + bcryptjs hash helpers (D-05/D-06).
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const ENC = new TextEncoder();

function getSecret(): Uint8Array {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_COOKIE_SECRET missing or too short (need >= 32 hex chars)');
  }
  return ENC.encode(s);
}

export async function signSession(payload: { username: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<{ username: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.username !== 'string') {
    throw new Error('Invalid session payload');
  }
  return { username: payload.username };
}

export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export const COOKIE_NAME = 'al_session';
export const COOKIE_MAX_AGE_S = 60 * 60 * 12; // 12h per D-06
