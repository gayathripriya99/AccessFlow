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
