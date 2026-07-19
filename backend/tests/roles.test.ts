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

describe('Role hierarchy (Phase 7)', () => {
  it('creates a child role with a parent and resolves effectivePermissions/ancestorNames', async () => {
    const auth = await authHeader();
    const parentPermissionId = await createPermission(auth, 'org.manage');

    const parent = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'senior-manager', description: 'x', permissions: [parentPermissionId] });
    const parentId = parent.body.data.id;

    const childPermissionId = await createPermission(auth, 'team.manage');
    const child = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({
        name: 'manager',
        description: 'x',
        permissions: [childPermissionId],
        parentRoleId: parentId,
      });

    expect(child.status).toBe(201);
    const childId = child.body.data.id;

    const detail = await request(app).get(`/api/v1/roles/${childId}`).set('Authorization', auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.parentRole).toMatchObject({ id: parentId, name: 'senior-manager' });
    expect(detail.body.data.ancestorNames).toEqual(['senior-manager']);
    expect(detail.body.data.effectivePermissions).toEqual(
      expect.arrayContaining(['team.manage', 'org.manage']),
    );
  });

  it('rejects an unknown parentRoleId with 400', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'orphan-attempt', description: 'x', parentRoleId: '507f1f77bcf86cd799439011' });
    expect(res.status).toBe(400);
  });

  it('rejects a self-parent and a transitive cycle with 400', async () => {
    const auth = await authHeader();

    const a = await request(app).post('/api/v1/roles').set('Authorization', auth).send({ name: 'cycle-a', description: 'x' });
    const aId = a.body.data.id;

    const selfParent = await request(app)
      .patch(`/api/v1/roles/${aId}`)
      .set('Authorization', auth)
      .send({ parentRoleId: aId });
    expect(selfParent.status).toBe(400);

    const b = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'cycle-b', description: 'x', parentRoleId: aId });
    const bId = b.body.data.id;

    // a -> b would close the loop, since b's parent is already a.
    const transitiveCycle = await request(app)
      .patch(`/api/v1/roles/${aId}`)
      .set('Authorization', auth)
      .send({ parentRoleId: bId });
    expect(transitiveCycle.status).toBe(400);
  });

  it('inherited permissions actually authorize real requests, not just the Role API response', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const other = await createAuthenticatedUser(app);

    const parent = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'reader-parent', description: 'x', permissions: [] });
    // The parent bundles a real baseline permission so the child can use it to pass a gated route.
    const usersReadPermission = await request(app)
      .get('/api/v1/permissions?search=users.read')
      .set('Authorization', auth);
    const usersReadId = usersReadPermission.body.data[0].id;
    await request(app)
      .patch(`/api/v1/roles/${parent.body.data.id}`)
      .set('Authorization', auth)
      .send({ permissions: [usersReadId] });

    const child = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'reader-child', description: 'x', permissions: [], parentRoleId: parent.body.data.id });

    // Before assignment: no access.
    const before = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${other.accessToken}`);
    expect(before.status).toBe(403);

    await request(app)
      .patch(`/api/v1/users/${other.userId}`)
      .set('Authorization', auth)
      .send({ roles: [child.body.data.id] });

    // After assignment: the child role itself has no direct permissions —
    // access must be coming from the parent's inherited permission.
    const after = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${other.accessToken}`);
    expect(after.status).toBe(200);
  });

  it('deleting a parent role nulls out parentRole on its children, not a dangling reference', async () => {
    const auth = await authHeader();
    const parent = await request(app).post('/api/v1/roles').set('Authorization', auth).send({ name: 'doomed-parent', description: 'x' });
    const child = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'surviving-child', description: 'x', parentRoleId: parent.body.data.id });

    await request(app).delete(`/api/v1/roles/${parent.body.data.id}`).set('Authorization', auth);

    const childAfter = await request(app).get(`/api/v1/roles/${child.body.data.id}`).set('Authorization', auth);
    expect(childAfter.status).toBe(200);
    expect(childAfter.body.data.parentRole).toBeNull();
    expect(childAfter.body.data.ancestorNames).toEqual([]);
  });

  it('clears an existing parent by sending parentRoleId: null', async () => {
    const auth = await authHeader();
    const parent = await request(app).post('/api/v1/roles').set('Authorization', auth).send({ name: 'clearable-parent', description: 'x' });
    const child = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'clearable-child', description: 'x', parentRoleId: parent.body.data.id });

    const cleared = await request(app)
      .patch(`/api/v1/roles/${child.body.data.id}`)
      .set('Authorization', auth)
      .send({ parentRoleId: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.parentRole).toBeNull();
  });
});
