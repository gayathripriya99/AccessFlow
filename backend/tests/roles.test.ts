import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

async function createPermission(auth: string, name: string) {
  const res = await request(app)
    .post('/api/v1/permissions')
    .set('Authorization', auth)
    .send({ name, description: `Permission ${name}` });
  return res.body.data.id;
}

describe('Roles API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/roles');
    expect(res.status).toBe(401);
  });

  it('creates a role with attached permissions', async () => {
    const auth = await authHeader();
    const permissionId = await createPermission(auth, 'billing.read');

    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'billing-viewer', description: 'Views billing', permissions: [permissionId] });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('billing-viewer');
    expect(res.body.data.permissions).toEqual([permissionId]);
  });

  it('rejects an unknown permission id with 400', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'ghost-role', description: 'x', permissions: ['507f1f77bcf86cd799439011'] });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate role name with 409', async () => {
    const auth = await authHeader();
    await request(app).post('/api/v1/roles').set('Authorization', auth).send({ name: 'support', description: 'x' });
    const dup = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'support', description: 'y' });

    expect(dup.status).toBe(409);
  });

  it('gets a role with populated permissions', async () => {
    const auth = await authHeader();
    const permissionId = await createPermission(auth, 'reports.read');
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'reporter', description: 'x', permissions: [permissionId] });
    const roleId = created.body.data.id;

    const res = await request(app).get(`/api/v1/roles/${roleId}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.permissions[0]).toMatchObject({ id: permissionId, name: 'reports.read' });
  });

  it('updates a role and deletes it, cascading out of assigned users', async () => {
    const auth = await authHeader();
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'temp-role', description: 'x' });
    const roleId = created.body.data.id;

    const updated = await request(app)
      .patch(`/api/v1/roles/${roleId}`)
      .set('Authorization', auth)
      .send({ description: 'updated description' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('updated description');

    const { userId } = await createAuthenticatedUser(app);
    await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', auth)
      .send({ roles: [roleId] });

    const deleted = await request(app).delete(`/api/v1/roles/${roleId}`).set('Authorization', auth);
    expect(deleted.status).toBe(204);

    const userAfter = await request(app).get(`/api/v1/users/${userId}`).set('Authorization', auth);
    expect(userAfter.body.data.roles).toEqual([]);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const auth = `Bearer ${accessToken}`;

    const list = await request(app).get('/api/v1/roles').set('Authorization', auth);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'unauthorized-role', description: 'x' });
    expect(create.status).toBe(403);
  });
});
