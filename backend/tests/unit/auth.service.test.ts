import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');

// Set required env vars for JWT
process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const mockDb = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new AuthService(mockDb);

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ValidationError when password is too short', async () => {
      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: '123' }),
      ).rejects.toThrow('La contraseña debe tener al menos 8 caracteres');
    });

    it('throws ConflictError when email already exists', async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue({ id: '1', email: 'test@test.com' });
      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow('Ya existe una cuenta con ese correo electrónico');
    });

    it('creates user successfully', async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockDb.user.create as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'new@test.com',
        name: 'New User',
        avatarUrl: null,
      });
      (mockDb.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({
        name: 'New User',
        email: 'new@test.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('new@test.com');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });
  });

  describe('login', () => {
    it('throws UnauthorizedError when user not found', async () => {
      (mockDb.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: 'noone@test.com', password: 'password123' }),
      ).rejects.toThrow('Credenciales incorrectas');
    });
  });
});
