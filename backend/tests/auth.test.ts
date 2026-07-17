import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

const credentials = {
  email: 'jane.doe@example.com',
  password: 'Str0ngPassw0rd!',
  name: 'Jane Doe',
};

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('creates a new user and never returns the password hash', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(credentials);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ email: credentials.email, name: credentials.name });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app).post('/api/v1/auth/register').send(credentials);
      const res = await request(app).post('/api/v1/auth/register').send(credentials);

      expect(res.status).toBe(409);
    });

    it('rejects a weak password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...credentials, email: 'weak@example.com', password: 'weak' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(credentials);
    });

    it('rejects an incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'WrongPassword1' });

      expect(res.status).toBe(401);
    });

    it('issues an access token and sets a refresh cookie on success', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.headers['set-cookie']?.[0]).toMatch(/accessflow_refresh_token=/);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid access token', async () => {
      await request(app).post('/api/v1/auth/register').send(credentials);
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(credentials.email);
      // This is the first (and only) user in this test's DB, so admin
      // bootstrap (Phase 3) grants them the full baseline permission set.
      expect(res.body.data.roles).toEqual(['admin']);
      expect(res.body.data.permissions).toEqual(expect.arrayContaining(['users.read', 'roles.create']));
      expect(res.body.data.permissions).toHaveLength(11);
    });
  });

  describe('POST /api/v1/auth/refresh and /logout', () => {
    it('rotates the refresh token and rejects reuse of the old one', async () => {
      const agent = request.agent(app);
      await agent.post('/api/v1/auth/register').send(credentials);
      const login = await agent
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password });

      const oldCookie = login.headers['set-cookie'];

      const refreshed = await agent.post('/api/v1/auth/refresh');
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.accessToken).toEqual(expect.any(String));

      const reuseAttempt = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
      expect(reuseAttempt.status).toBe(401);
    });

    it('revokes the refresh token on logout so it can no longer be used', async () => {
      const agent = request.agent(app);
      await agent.post('/api/v1/auth/register').send(credentials);
      await agent.post('/api/v1/auth/login').send({ email: credentials.email, password: credentials.password });

      const logoutRes = await agent.post('/api/v1/auth/logout');
      expect(logoutRes.status).toBe(204);

      const refreshAfterLogout = await agent.post('/api/v1/auth/refresh');
      expect(refreshAfterLogout.status).toBe(401);
    });
  });
});
