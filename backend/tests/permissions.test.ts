import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

describe('Permissions API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/permissions');
    expect(res.status).toBe(401);
  });

  it('creates a permission and rejects a duplicate name', async () => {
    const auth = await authHeader();

    const created = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'inventory.read', description: 'Read inventory records' });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'inventory.read', description: 'Read inventory records' });

    const duplicate = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'inventory.read', description: 'Different description' });

    expect(duplicate.status).toBe(409);
  });

  it('rejects an invalid name format', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'Users Read!', description: 'bad name' });

    expect(res.status).toBe(400);
  });

  it('lists, paginates, and filters permissions by search', async () => {
    const auth = await authHeader();
    await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'catalog.read', description: 'Read catalog' });
    await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'catalog.write', description: 'Write catalog' });

    const res = await request(app).get('/api/v1/permissions?search=catalog.w').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('catalog.write');
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('updates and deletes a permission, and cascades the delete out of roles', async () => {
    const auth = await authHeader();

    const permission = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'audit.read', description: 'Read audit logs' });
    const permissionId = permission.body.data.id ?? permission.body.data._id;

    const updated = await request(app)
      .patch(`/api/v1/permissions/${permissionId}`)
      .set('Authorization', auth)
      .send({ description: 'Read audit log entries' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Read audit log entries');

    const role = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'auditor', description: 'Auditor role', permissions: [permissionId] });
    expect(role.status).toBe(201);
    const roleId = role.body.data.id ?? role.body.data._id;

    const deleted = await request(app).delete(`/api/v1/permissions/${permissionId}`).set('Authorization', auth);
    expect(deleted.status).toBe(204);

    const roleAfter = await request(app).get(`/api/v1/roles/${roleId}`).set('Authorization', auth);
    expect(roleAfter.body.data.permissions).toEqual([]);

    const getDeleted = await request(app).get(`/api/v1/permissions/${permissionId}`).set('Authorization', auth);
    expect(getDeleted.status).toBe(404);
  });

  it('returns 404 for a non-existent permission id and 400 for a malformed one', async () => {
    const auth = await authHeader();
    const missing = await request(app)
      .get('/api/v1/permissions/507f1f77bcf86cd799439011')
      .set('Authorization', auth);
    expect(missing.status).toBe(404);

    const malformed = await request(app).get('/api/v1/permissions/not-an-id').set('Authorization', auth);
    expect(malformed.status).toBe(400);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const auth = `Bearer ${accessToken}`;

    const list = await request(app).get('/api/v1/permissions').set('Authorization', auth);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'inventory.write', description: 'Write inventory' });
    expect(create.status).toBe(403);
  });
});
