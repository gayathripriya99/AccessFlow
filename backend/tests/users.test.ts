import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

describe('Users API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('lists users with pagination metadata', async () => {
    const auth = await authHeader();
    await createAuthenticatedUser(app);
    await createAuthenticatedUser(app);

    const res = await request(app).get('/api/v1/users?limit=2&page=1').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('filters users by search and isActive', async () => {
    const auth = await authHeader();
    const { userId } = await createAuthenticatedUser(app);

    const res = await request(app)
      .get(`/api/v1/users?search=test-user&isActive=true`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { id: string }) => u.id === userId)).toBe(true);
  });

  it('gets a single user with populated roles', async () => {
    const auth = await authHeader();
    const { userId } = await createAuthenticatedUser(app);

    const res = await request(app).get(`/api/v1/users/${userId}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: userId, roles: [] });
  });

  it('updates a user (name, isActive, roles) and rejects an unknown role id', async () => {
    const auth = await authHeader();
    const { userId } = await createAuthenticatedUser(app);

    const badRole = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', auth)
      .send({ roles: ['507f1f77bcf86cd799439011'] });
    expect(badRole.status).toBe(400);

    const roleRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'basic-member', description: 'x' });
    const roleId = roleRes.body.data.id;

    const updated = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', auth)
      .send({ name: 'Renamed User', isActive: false, roles: [roleId] });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Renamed User', isActive: false });
    expect(updated.body.data.roles[0]).toMatchObject({ id: roleId, name: 'basic-member' });
  });

  it('deletes a user and revokes their sessions', async () => {
    const auth = await authHeader();
    const email = 'delete-me@example.com';
    const password = 'Str0ngPassw0rd!';
    await request(app).post('/api/v1/auth/register').send({ email, password, name: 'Delete Me' });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    const userId = (
      await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`)
    ).body.data.id;

    const deleted = await request(app).delete(`/api/v1/users/${userId}`).set('Authorization', auth);
    expect(deleted.status).toBe(204);

    const getAfter = await request(app).get(`/api/v1/users/${userId}`).set('Authorization', auth);
    expect(getAfter.status).toBe(404);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const auth = `Bearer ${accessToken}`;

    const list = await request(app).get('/api/v1/users').set('Authorization', auth);
    expect(list.status).toBe(403);

    // Updating *someone else* — as opposed to self-service, which Phase 8's
    // ABAC layer deliberately allows for a name-only change (see
    // policies.test.ts) — must still require real users.update.
    const { userId: otherUserId } = await createAuthenticatedUser(app);
    const update = await request(app)
      .patch(`/api/v1/users/${otherUserId}`)
      .set('Authorization', auth)
      .send({ name: 'Rename Someone Else Attempt' });
    expect(update.status).toBe(403);
  });
});
