import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser, createNonAdminUser } from './helpers/authenticatedUser';

const app = createApp();

async function authHeader() {
  const { accessToken } = await createAuthenticatedUser(app);
  return `Bearer ${accessToken}`;
}

function validPolicyBody(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    description: `Policy ${name}`,
    resource: 'user',
    action: 'read',
    effect: 'allow',
    conditions: [{ attribute: 'resource.id', operator: 'equals', compareTo: 'subject.id' }],
    ...overrides,
  };
}

describe('Policies API (ABAC config)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/policies');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin authenticated user with 403', async () => {
    const { accessToken } = await createNonAdminUser(app);
    const auth = `Bearer ${accessToken}`;

    const list = await request(app).get('/api/v1/policies').set('Authorization', auth);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('unauthorized-policy'));
    expect(create.status).toBe(403);
  });

  it('creates, lists, gets, updates, and deletes a policy', async () => {
    const auth = await authHeader();

    const created = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('crud-test-policy'));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'crud-test-policy', effect: 'allow', enabled: true });
    const policyId = created.body.data.id;

    const list = await request(app).get('/api/v1/policies?search=crud-test').set('Authorization', auth);
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { id: string }) => p.id === policyId)).toBe(true);

    const got = await request(app).get(`/api/v1/policies/${policyId}`).set('Authorization', auth);
    expect(got.status).toBe(200);
    expect(got.body.data.name).toBe('crud-test-policy');

    const updated = await request(app)
      .patch(`/api/v1/policies/${policyId}`)
      .set('Authorization', auth)
      .send({ enabled: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.enabled).toBe(false);

    const deleted = await request(app).delete(`/api/v1/policies/${policyId}`).set('Authorization', auth);
    expect(deleted.status).toBe(204);

    const getAfterDelete = await request(app).get(`/api/v1/policies/${policyId}`).set('Authorization', auth);
    expect(getAfterDelete.status).toBe(404);
  });

  it('rejects a duplicate policy name with 409', async () => {
    const auth = await authHeader();
    await request(app).post('/api/v1/policies').set('Authorization', auth).send(validPolicyBody('dup-policy'));
    const dup = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('dup-policy'));
    expect(dup.status).toBe(409);
  });

  it('rejects an invalid resource, action, or effect', async () => {
    const auth = await authHeader();
    const badResource = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('bad-resource', { resource: 'document' }));
    expect(badResource.status).toBe(400);

    const badAction = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('bad-action', { action: 'create' }));
    expect(badAction.status).toBe(400);

    const badEffect = await request(app)
      .post('/api/v1/policies')
      .set('Authorization', auth)
      .send(validPolicyBody('bad-effect', { effect: 'maybe' }));
    expect(badEffect.status).toBe(400);
  });
});

describe('ABAC self-service access (Phase 8)', () => {
  it('lets a permission-less user view their own profile, but not another user\'s', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const self = await createAuthenticatedUser(app);
    const other = await createAuthenticatedUser(app);

    const ownProfile = await request(app)
      .get(`/api/v1/users/${self.userId}`)
      .set('Authorization', `Bearer ${self.accessToken}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.data.id).toBe(self.userId);

    const someoneElsesProfile = await request(app)
      .get(`/api/v1/users/${other.userId}`)
      .set('Authorization', `Bearer ${self.accessToken}`);
    expect(someoneElsesProfile.status).toBe(403);

    // Sanity: an admin (real users.read) still reaches both regardless of ABAC.
    const adminViewsOther = await request(app).get(`/api/v1/users/${other.userId}`).set('Authorization', auth);
    expect(adminViewsOther.status).toBe(200);
  });

  it('lets a permission-less user rename themself, but not grant themself roles or reactivate/deactivate themself', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const self = await createAuthenticatedUser(app);
    const selfAuth = `Bearer ${self.accessToken}`;

    const renamed = await request(app)
      .patch(`/api/v1/users/${self.userId}`)
      .set('Authorization', selfAuth)
      .send({ name: 'Renamed By Self' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Renamed By Self');

    const role = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'self-grant-attempt', description: 'x' });

    const selfGrantRoles = await request(app)
      .patch(`/api/v1/users/${self.userId}`)
      .set('Authorization', selfAuth)
      .send({ roles: [role.body.data.id] });
    expect(selfGrantRoles.status).toBe(403);

    const selfReactivate = await request(app)
      .patch(`/api/v1/users/${self.userId}`)
      .set('Authorization', selfAuth)
      .send({ isActive: true });
    expect(selfReactivate.status).toBe(403);
  });

  it('denies self-delete even for a user who holds users.delete via a role, but allows deleting someone else', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;

    const usersDeletePermission = await request(app)
      .get('/api/v1/permissions?search=users.delete')
      .set('Authorization', auth);
    const permissionId = usersDeletePermission.body.data[0].id;
    const role = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', auth)
      .send({ name: 'can-delete-users', description: 'x', permissions: [permissionId] });

    const deleter = await createAuthenticatedUser(app);
    const victim = await createAuthenticatedUser(app);
    await request(app)
      .patch(`/api/v1/users/${deleter.userId}`)
      .set('Authorization', auth)
      .send({ roles: [role.body.data.id] });

    const selfDelete = await request(app)
      .delete(`/api/v1/users/${deleter.userId}`)
      .set('Authorization', `Bearer ${deleter.accessToken}`);
    expect(selfDelete.status).toBe(403);

    const deleteOther = await request(app)
      .delete(`/api/v1/users/${victim.userId}`)
      .set('Authorization', `Bearer ${deleter.accessToken}`);
    expect(deleteOther.status).toBe(204);
  });

  it('stops applying once the underlying policy is disabled or deleted', async () => {
    const admin = await createAuthenticatedUser(app);
    const auth = `Bearer ${admin.accessToken}`;
    const self = await createAuthenticatedUser(app);
    const selfAuth = `Bearer ${self.accessToken}`;

    const policies = await request(app).get('/api/v1/policies?search=self-service-read').set('Authorization', auth);
    const policyId = policies.body.data.find((p: { name: string }) => p.name === 'self-service-read').id;

    await request(app).patch(`/api/v1/policies/${policyId}`).set('Authorization', auth).send({ enabled: false });

    const blockedWhileDisabled = await request(app)
      .get(`/api/v1/users/${self.userId}`)
      .set('Authorization', selfAuth);
    expect(blockedWhileDisabled.status).toBe(403);

    await request(app).patch(`/api/v1/policies/${policyId}`).set('Authorization', auth).send({ enabled: true });
    await request(app).delete(`/api/v1/policies/${policyId}`).set('Authorization', auth);

    const blockedAfterDelete = await request(app)
      .get(`/api/v1/users/${self.userId}`)
      .set('Authorization', selfAuth);
    expect(blockedAfterDelete.status).toBe(403);
  });
});
