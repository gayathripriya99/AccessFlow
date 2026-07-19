import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

describe('Audit Logs API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('lists audit entries newest-first, with the actor populated', async () => {
    // Registering + logging in the first user (admin bootstrap) already
    // produces auth.register and auth.login.success entries to list against.
    const auth = await authHeader();

    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const actions = res.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.register', 'auth.login.success']));

    // auth.login.success was recorded after auth.register, so it sorts first.
    const loginIndex = actions.indexOf('auth.login.success');
    const registerIndex = actions.indexOf('auth.register');
    expect(loginIndex).toBeLessThan(registerIndex);

    const loginEntry = res.body.data[loginIndex];
    expect(loginEntry.userId).toMatchObject({ name: expect.any(String), email: expect.any(String) });
    expect(loginEntry.userId).not.toHaveProperty('_id');
    // auth.login.success never passes explicit metadata — regression guard
    // for Mongoose's `minimize` silently stripping the empty-object default.
    expect(loginEntry.metadata).toEqual({});
  });

  it('filters by action', async () => {
    const auth = await authHeader();

    const res = await request(app).get('/api/v1/audit-logs?action=auth.register').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].action).toBe('auth.register');
  });

  it('filters by userId', async () => {
    const first = await createAuthenticatedUser(app);
    const second = await createAuthenticatedUser(app);
    const auth = `Bearer ${first.accessToken}`;

    const res = await request(app).get(`/api/v1/audit-logs?userId=${second.userId}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const entry of res.body.data) {
      expect(entry.userId.id).toBe(second.userId);
    }
  });

  it('filters by date range', async () => {
    const auth = await authHeader();

    const future = new Date(Date.now() + 60_000).toISOString();
    const resFuture = await request(app).get(`/api/v1/audit-logs?from=${future}`).set('Authorization', auth);
    expect(resFuture.status).toBe(200);
    expect(resFuture.body.data).toHaveLength(0);

    const past = new Date(Date.now() - 60_000).toISOString();
    const resPast = await request(app).get(`/api/v1/audit-logs?from=${past}`).set('Authorization', auth);
    expect(resPast.status).toBe(200);
    expect(resPast.body.data.length).toBeGreaterThan(0);
  });

  it('rejects an invalid action filter and an invalid userId filter', async () => {
    const auth = await authHeader();

    const badAction = await request(app).get('/api/v1/audit-logs?action=not.a.real.action').set('Authorization', auth);
    expect(badAction.status).toBe(400);

    const badUserId = await request(app).get('/api/v1/audit-logs?userId=not-an-id').set('Authorization', auth);
    expect(badUserId.status).toBe(400);
  });

  it('paginates', async () => {
    const auth = await authHeader();

    const res = await request(app).get('/api/v1/audit-logs?page=1&limit=1').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });
});
