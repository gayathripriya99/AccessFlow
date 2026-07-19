import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

describe('Permission Simulator API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/simulator/check').send({ mode: 'roles', roleIds: [], permission: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ mode: 'user', userId: '507f1f77bcf86cd799439011', permission: 'users.read' });
    expect(res.status).toBe(403);
  });

  it('user mode: allows a permission granted by the caller\'s own admin role', async () => {
    const { accessToken, userId } = await createAuthenticatedUser(app);
    const auth = `Bearer ${accessToken}`;

    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId, permission: 'roles.read' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ allowed: true, permission: 'roles.read', grantedByRoles: ['admin'] });
    expect(res.body.data.resolvedPermissions).toEqual(expect.arrayContaining(['roles.read', 'users.read']));
  });

  it('user mode: denies a permission the target user\'s roles do not grant', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const other = await createAuthenticatedUser(app);

    const role = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'reader-only', description: 'x' });
    const permission = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'reports.view', description: 'x' });
    await request(app)
      .patch(`/api/v1/roles/${role.body.data.id}`)
      .set('Authorization', auth)
      .send({ permissions: [permission.body.data.id] });
    await request(app)
      .patch(`/api/v1/users/${other.userId}`)
      .set('Authorization', auth)
      .send({ roles: [role.body.data.id] });

    const denied = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId: other.userId, permission: 'roles.read' });
    expect(denied.status).toBe(200);
    expect(denied.body.data).toMatchObject({ allowed: false, grantedByRoles: [] });

    const allowed = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId: other.userId, permission: 'reports.view' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toMatchObject({ allowed: true, grantedByRoles: ['reader-only'] });
  });

  it('user mode: a deactivated user always resolves to denied, even if a role would grant it', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const other = await createAuthenticatedUser(app);

    await request(app)
      .patch(`/api/v1/users/${other.userId}`)
      .set('Authorization', auth)
      .send({ isActive: false });

    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId: other.userId, permission: 'users.read' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ allowed: false, userActive: false });
  });

  it('user mode: 404 for a nonexistent user id', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId: '507f1f77bcf86cd799439011', permission: 'users.read' });
    expect(res.status).toBe(404);
  });

  it('roles mode: resolves a hypothetical role selection without needing a real user', async () => {
    const auth = await authHeader();
    const roleA = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'hypo-a', description: 'x', permissions: [] });
    const permission = await request(app)
      .post('/api/v1/permissions')
      .set('Authorization', auth)
      .send({ name: 'billing.view', description: 'x' });
    const roleB = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'hypo-b', description: 'x', permissions: [permission.body.data.id] });

    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'roles', roleIds: [roleA.body.data.id, roleB.body.data.id], permission: 'billing.view' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      allowed: true,
      grantedByRoles: ['hypo-b'],
      roleNames: expect.arrayContaining(['hypo-a', 'hypo-b']),
    });
    expect(res.body.data).not.toHaveProperty('userActive');
  });

  it('roles mode: 400 for an unknown role id', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'roles', roleIds: ['507f1f77bcf86cd799439011'], permission: 'users.read' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid input', async () => {
    const auth = await authHeader();

    const badPermission = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'roles', roleIds: ['507f1f77bcf86cd799439011'], permission: 'Not Valid!' });
    expect(badPermission.status).toBe(400);

    const badUserId = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'user', userId: 'not-an-id', permission: 'users.read' });
    expect(badUserId.status).toBe(400);

    const emptyRoles = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'roles', roleIds: [], permission: 'users.read' });
    expect(emptyRoles.status).toBe(400);

    const badMode = await request(app)
      .post('/api/v1/simulator/check')
      .set('Authorization', auth)
      .send({ mode: 'nonsense', permission: 'users.read' });
    expect(badMode.status).toBe(400);
  });
});
