import request from 'supertest';
import { app } from '../index.js'; // Assuming index.js exports the app correctly
import Admin from '../models/admin.model.js';
import mongoose from 'mongoose';

describe('Auth Flow - /api/admins', () => {
  let regularAdminToken;
  let superAdminToken;
  let regularAdminId;
  let superAdminId;

  const regularAdminCredentials = {
    email: 'testadmin@example.com',
    password: 'password123',
    name: 'Test Admin',
  };

  const superAdminCredentials = {
    email: 'superadmin@example.com',
    password: 'superpassword123',
    name: 'Super Admin',
    isSuperAdmin: true,
  };

  beforeAll(async () => {
    // Create a regular admin for testing login and protected routes
    const regularAdmin = await Admin.create(regularAdminCredentials);
    regularAdminId = regularAdmin._id;

    // Create a super admin for testing super admin routes
    const superAdmin = await Admin.create(superAdminCredentials);
    superAdminId = superAdmin._id;

    // Log in as regular admin to get a token
    const resRegular = await request(app)
      .post('/api/admins/login')
      .send({
        email: regularAdminCredentials.email,
        password: regularAdminCredentials.password,
      });
    if (resRegular.headers['set-cookie']) {
      regularAdminToken = resRegular.headers['set-cookie'][0].split(';')[0]; // Extract cookie value
    } else {
      console.error('Failed to get token for regular admin in beforeAll:', resRegular.body);
    }


    // Log in as super admin to get a token
    const resSuper = await request(app)
      .post('/api/admins/login')
      .send({
        email: superAdminCredentials.email,
        password: superAdminCredentials.password,
      });
    if (resSuper.headers['set-cookie']) {
      superAdminToken = resSuper.headers['set-cookie'][0].split(';')[0]; // Extract cookie value
    } else {
      console.error('Failed to get token for super admin in beforeAll:', resSuper.body);
    }
  });

  // Cleanup after all tests in this suite
  afterAll(async () => {
    await Admin.deleteMany({});
  });


  describe('Admin Login (POST /api/admins/login)', () => {
    it('should login successfully with correct credentials and set jwt cookie', async () => {
      const res = await request(app)
        .post('/api/admins/login')
        .send({
          email: regularAdminCredentials.email,
          password: regularAdminCredentials.password,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.email).toEqual(regularAdminCredentials.email);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('jwt=');
      // Check that the cookie is not empty
      const cookieValue = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
      expect(cookieValue).not.toBe('');
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/admins/login')
        .send({
          email: regularAdminCredentials.email,
          password: 'wrongpassword',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });

    it('should fail login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/admins/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });
  });

  describe('Protected Route Access (GET /api/admins/profile)', () => {
    it('should access profile successfully with a valid token', async () => {
      expect(regularAdminToken).toBeDefined(); // Ensure token was set
      const res = await request(app)
        .get('/api/admins/profile')
        .set('Cookie', regularAdminToken);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('_id', regularAdminId.toString());
      expect(res.body).toHaveProperty('email', regularAdminCredentials.email);
    });

    it('should fail access without a token', async () => {
      const res = await request(app).get('/api/admins/profile');
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Not authorized, no token');
    });

    it('should fail access with a malformed/invalid token', async () => {
      const res = await request(app)
        .get('/api/admins/profile')
        .set('Cookie', 'jwt=invalidtoken123');
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Not authorized, token failed');
    });
  });

  describe('Super Admin Route Access (GET /api/admins)', () => {
    it('should be accessed by a super admin', async () => {
      expect(superAdminToken).toBeDefined();
      const res = await request(app)
        .get('/api/admins')
        .set('Cookie', superAdminToken);
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Check if both admins are in the list
      expect(res.body.some(admin => admin.email === regularAdminCredentials.email)).toBe(true);
      expect(res.body.some(admin => admin.email === superAdminCredentials.email)).toBe(true);
    });

    it('should be denied for a regular admin', async () => {
      expect(regularAdminToken).toBeDefined();
      const res = await request(app)
        .get('/api/admins')
        .set('Cookie', regularAdminToken);
      expect(res.statusCode).toEqual(401); // Or 403, current implementation uses 401
      expect(res.body).toHaveProperty('message', 'Not authorized as a super admin');
    });
  });

  describe('Logout (POST /api/admins/logout)', () => {
    it('should clear/expire the jwt cookie upon logout', async () => {
      // First, ensure the user is logged in and has a token
      const loginRes = await request(app)
        .post('/api/admins/login')
        .send({
          email: regularAdminCredentials.email,
          password: regularAdminCredentials.password,
        });
      expect(loginRes.statusCode).toEqual(200);
      const token = loginRes.headers['set-cookie'][0].split(';')[0];
      expect(token).toContain('jwt=');

      // Now, logout
      const logoutRes = await request(app)
        .post('/api/admins/logout')
        .set('Cookie', token); // Send the token of the user logging out

      expect(logoutRes.statusCode).toEqual(200);
      expect(logoutRes.body).toHaveProperty('message', 'Logged out successfully');

      // Check that the cookie is cleared or expired
      // The 'jwt' cookie should be set to empty or have an expiration date in the past.
      // Exact check depends on how the server clears it.
      // A common way is to set the cookie value to empty and max-age to 0 or expires to a past date.
      expect(logoutRes.headers['set-cookie']).toBeDefined();
      const logoutCookie = logoutRes.headers['set-cookie'][0];
      expect(logoutCookie).toContain('jwt=;'); // Check if jwt is empty
      expect(logoutCookie.toLowerCase()).toContain('expires=thu, 01 jan 1970'); // Check for past expiry
    });

    it('should require authentication to logout', async () => {
        // Attempt logout without a token
        const res = await request(app)
            .post('/api/admins/logout');
        
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('message', 'Not authorized, no token');
    });
  });
});
