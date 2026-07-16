import request from 'supertest';
import { Express } from 'express';

export interface AuthenticatedUser {
  accessToken: string;
  userId: string;
}

let counter = 0;

export async function createAuthenticatedUser(app: Express): Promise<AuthenticatedUser> {
  counter += 1;
  const email = `test-user-${counter}@example.com`;
  const password = 'Str0ngPassw0rd!';

  const register = await request(app).post('/api/v1/auth/register').send({
    email,
    password,
    name: `Test User ${counter}`,
  });

  const login = await request(app).post('/api/v1/auth/login').send({ email, password });

  return { accessToken: login.body.data.accessToken, userId: register.body.data.id };
}

/**
 * The very first user registered against a given database becomes admin
 * (see AdminBootstrapService). Tests that need a guaranteed non-admin user
 * — e.g. to assert 403 on a missing permission — should use this instead of
 * createAuthenticatedUser, which registers a throwaway first user to
 * consume the admin slot before creating and returning the real one.
 */
export async function createNonAdminUser(app: Express): Promise<AuthenticatedUser> {
  await createAuthenticatedUser(app);
  return createAuthenticatedUser(app);
}
