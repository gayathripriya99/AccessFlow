import { createHash } from 'node:crypto';

/**
 * Refresh tokens are high-entropy signed JWTs, so a fast SHA-256 digest is
 * sufficient for at-rest storage/comparison — unlike passwords, they don't
 * need bcrypt's deliberate slowness.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
