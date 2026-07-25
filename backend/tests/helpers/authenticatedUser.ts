import request from 'supertest';
import { Express } from 'express';

export interface AuthenticatedUser {
  accessToken: string;
  userId: string;
  tenantSlug: string;
}

let counter = 0;

/**
 * Always creates a brand-new organization; the registrant becomes that
 * org's bootstrap admin (Phase 9: admin bootstrap is per-tenant now, so this
 * property holds every time, unlike pre-Phase-9 where only the very first
 * call across the whole test file's DB got it). Use `joinOrg` instead
 * whenever a test needs a second user in the *same* tenant as one already
 * created.
 */
export async function createAuthenticatedUser(app: Express): Promise<AuthenticatedUser> {
  counter += 1;
  const email = `test-user-${counter}@example.com`;
  const password = 'Str0ngPassw0rd!';
  const tenantSlug = `test-org-${counter}`;

  const register = await request(app).post('/api/v1/auth/register').send({
    mode: 'create',
    email,
    password,
    name: `Test User ${counter}`,
    tenantName: `Test Org ${counter}`,
    tenantSlug,
  });

  const login = await request(app).post('/api/v1/auth/login').send({ email, password, tenantSlug });

  return { accessToken: login.body.data.accessToken, userId: register.body.data.id, tenantSlug };
}

/**
 * Registers a second (non-bootstrap) user into an *existing* org identified
 * by `tenantSlug` — mirrors "every later registration gets zero roles,"
 * just scoped per-tenant instead of per-database. Use this (not a second
 * createAuthenticatedUser call) whenever a test needs two users who must be
 * able to see/act on each other's data — same-org listing, role assignment
 * across users, ABAC self-vs-other checks, audit log actor filtering, etc.
 */
export async function joinOrg(app: Express, tenantSlug: string): Promise<AuthenticatedUser> {
  counter += 1;
  const email = `test-user-${counter}@example.com`;
  const password = 'Str0ngPassw0rd!';

  const register = await request(app).post('/api/v1/auth/register').send({
    mode: 'join',
    email,
    password,
    name: `Test User ${counter}`,
    tenantSlug,
  });

  const login = await request(app).post('/api/v1/auth/login').send({ email, password, tenantSlug });

  return { accessToken: login.body.data.accessToken, userId: register.body.data.id, tenantSlug };
}

/**
 * The first user registered into a given org becomes its admin (see
 * AdminBootstrapService, now per-tenant). Tests that need a guaranteed
 * non-admin user — e.g. to assert 403 on a missing permission — should use
 * this instead of createAuthenticatedUser: it creates a fresh org (consuming
 * the admin slot) and returns a second user who joined that same org.
 */
export async function createNonAdminUser(app: Express): Promise<AuthenticatedUser> {
  const admin = await createAuthenticatedUser(app);
  return joinOrg(app, admin.tenantSlug);
}
