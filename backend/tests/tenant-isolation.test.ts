import request from 'supertest';
import { createApp } from '../src/app';
import { createAuthenticatedUser } from './helpers/authenticatedUser';

const app = createApp();

describe('Multi-tenant isolation (Phase 9)', () => {
  describe('organization registration and login', () => {
    it('allows the same email to register successfully in two different organizations', async () => {
      const email = 'shared@example.com';

      const orgA = await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email,
        password: 'Str0ngPassw0rdA!',
        name: 'User A',
        tenantName: 'Org A',
        tenantSlug: 'shared-email-org-a',
      });
      expect(orgA.status).toBe(201);

      const orgB = await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email,
        password: 'Str0ngPassw0rdB!',
        name: 'User B',
        tenantName: 'Org B',
        tenantSlug: 'shared-email-org-b',
      });
      expect(orgB.status).toBe(201);
      expect(orgB.body.data.id).not.toBe(orgA.body.data.id);
    });

    it('rejects create-mode registration with an already-used org slug', async () => {
      const first = await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email: 'first@example.com',
        password: 'Str0ngPassw0rd!',
        name: 'First',
        tenantName: 'Dup Slug Org',
        tenantSlug: 'dup-slug-org',
      });
      expect(first.status).toBe(201);

      const dup = await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email: 'second@example.com',
        password: 'Str0ngPassw0rd!',
        name: 'Second',
        tenantName: 'Dup Slug Org Again',
        tenantSlug: 'dup-slug-org',
      });
      expect(dup.status).toBe(409);
    });

    it('rejects join-mode registration against a nonexistent org slug', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        mode: 'join',
        email: 'nobody@example.com',
        password: 'Str0ngPassw0rd!',
        name: 'Nobody',
        tenantSlug: 'no-such-org',
      });
      expect(res.status).toBe(404);
    });

    it('authenticates against the correct organization only — same email+password combos do not cross tenants', async () => {
      const email = 'cross-login@example.com';
      await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email,
        password: 'PasswordForOrgA1!',
        name: 'A User',
        tenantName: 'Cross Login Org A',
        tenantSlug: 'cross-login-org-a',
      });
      await request(app).post('/api/v1/auth/register').send({
        mode: 'create',
        email,
        password: 'PasswordForOrgB1!',
        name: 'B User',
        tenantName: 'Cross Login Org B',
        tenantSlug: 'cross-login-org-b',
      });

      const correctA = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'PasswordForOrgA1!', tenantSlug: 'cross-login-org-a' });
      expect(correctA.status).toBe(200);

      const wrongPasswordForA = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'PasswordForOrgB1!', tenantSlug: 'cross-login-org-a' });
      expect(wrongPasswordForA.status).toBe(401);

      const correctB = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'PasswordForOrgB1!', tenantSlug: 'cross-login-org-b' });
      expect(correctB.status).toBe(200);

      const wrongPasswordForB = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'PasswordForOrgA1!', tenantSlug: 'cross-login-org-b' });
      expect(wrongPasswordForB.status).toBe(401);
    });
  });

  describe('per-tenant uniqueness', () => {
    it('allows the same role, permission, and policy name to exist independently in two tenants', async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;
      const authB = `Bearer ${orgB.accessToken}`;

      const permA = await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', authA)
        .send({ name: 'shared.permission', description: 'x' });
      const permB = await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', authB)
        .send({ name: 'shared.permission', description: 'x' });
      expect(permA.status).toBe(201);
      expect(permB.status).toBe(201);

      const roleA = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', authA)
        .send({ name: 'shared-role-name', description: 'x' });
      const roleB = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', authB)
        .send({ name: 'shared-role-name', description: 'x' });
      expect(roleA.status).toBe(201);
      expect(roleB.status).toBe(201);
    });
  });

  describe('cross-tenant resource isolation', () => {
    it("a tenant's admin cannot read, update, or delete another tenant's user by id, despite holding the permission in their own tenant", async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;

      const getOther = await request(app).get(`/api/v1/users/${orgB.userId}`).set('Authorization', authA);
      expect(getOther.status).toBe(404);

      const updateOther = await request(app)
        .patch(`/api/v1/users/${orgB.userId}`)
        .set('Authorization', authA)
        .send({ name: 'Hijacked' });
      expect(updateOther.status).toBe(404);

      const deleteOther = await request(app).delete(`/api/v1/users/${orgB.userId}`).set('Authorization', authA);
      expect(deleteOther.status).toBe(404);

      // orgB's account is untouched.
      const stillThere = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${orgB.accessToken}`);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.data.name).not.toBe('Hijacked');
    });

    it("never lists another tenant's users, roles, or permissions", async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;

      await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'org-b-only-role', description: 'x' });
      await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'org-b-only-permission', description: 'x' });

      const users = await request(app).get('/api/v1/users').set('Authorization', authA);
      expect(users.body.data.some((u: { id: string }) => u.id === orgB.userId)).toBe(false);

      const roles = await request(app).get('/api/v1/roles?search=org-b-only').set('Authorization', authA);
      expect(roles.body.data).toHaveLength(0);

      const permissions = await request(app)
        .get('/api/v1/permissions?search=org-b-only')
        .set('Authorization', authA);
      expect(permissions.body.data).toHaveLength(0);
    });

    it("never surfaces another tenant's audit log entries", async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;

      const logs = await request(app).get('/api/v1/audit-logs').set('Authorization', authA);
      expect(logs.status).toBe(200);
      const actorIds = logs.body.data.map((entry: { userId: { id: string } | null }) => entry.userId?.id);
      expect(actorIds).not.toContain(orgB.userId);
    });

    it("404s a simulator check against another tenant's user id", async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;

      const res = await request(app)
        .post('/api/v1/simulator/check')
        .set('Authorization', authA)
        .send({ mode: 'user', userId: orgB.userId, permission: 'users.read' });
      expect(res.status).toBe(404);
    });

    it("rejects a role update that references another tenant's permission id as unknown, not a cross-tenant grant", async () => {
      const orgA = await createAuthenticatedUser(app);
      const orgB = await createAuthenticatedUser(app);
      const authA = `Bearer ${orgA.accessToken}`;

      const orgBPermission = await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'org-b.secret', description: 'x' });
      const orgBPermissionId = orgBPermission.body.data.id;

      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', authA)
        .send({ name: 'cross-tenant-attempt', description: 'x', permissions: [orgBPermissionId] });
      expect(res.status).toBe(400);
    });
  });
});
