import { AuthService } from '../../src/modules/auth/auth.service';
import { authResolvers } from '../../src/modules/auth/auth.resolver';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../../src/utils/error.utils';

jest.mock('@prisma/client');
jest.mock('../../src/modules/auth/auth.service');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

const mockPrisma = {} as PrismaClient;
const mockContext = { prisma: mockPrisma, user: null };

const fakePayload = {
  accessToken: 'acc-token',
  refreshToken: 'ref-token',
  user: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null, createdAt: new Date().toISOString() },
};

beforeEach(() => {
  jest.clearAllMocks();
  MockedAuthService.prototype.register = jest.fn().mockResolvedValue(fakePayload);
  MockedAuthService.prototype.login = jest.fn().mockResolvedValue(fakePayload);
  MockedAuthService.prototype.refreshTokens = jest.fn().mockResolvedValue(fakePayload);
  MockedAuthService.prototype.logout = jest.fn().mockResolvedValue(true);
});

describe('authResolvers', () => {
  describe('Mutation.register', () => {
    it('delegates to AuthService.register with the correct input', async () => {
      const input = { name: 'Ana', email: 'ana@test.com', password: 'password123' };
      const result = await authResolvers.Mutation.register(null, { input }, mockContext as any);
      expect(MockedAuthService.prototype.register).toHaveBeenCalledWith(input);
      expect(result).toEqual(fakePayload);
    });

    it('propagates errors thrown by the service', async () => {
      MockedAuthService.prototype.register = jest.fn().mockRejectedValue(new Error('Email exists'));
      await expect(
        authResolvers.Mutation.register(null, { input: { name: 'X', email: 'x@test.com', password: 'pass1234' } }, mockContext as any),
      ).rejects.toThrow('Email exists');
    });
  });

  describe('Mutation.login', () => {
    it('delegates to AuthService.login with the correct input', async () => {
      const input = { email: 'ana@test.com', password: 'password123' };
      const result = await authResolvers.Mutation.login(null, { input }, mockContext as any);
      expect(MockedAuthService.prototype.login).toHaveBeenCalledWith(input);
      expect(result).toEqual(fakePayload);
    });

    it('propagates UnauthorizedError from the service', async () => {
      MockedAuthService.prototype.login = jest.fn().mockRejectedValue(new UnauthorizedError('Credenciales inválidas'));
      await expect(
        authResolvers.Mutation.login(null, { input: { email: 'bad@test.com', password: 'wrong' } }, mockContext as any),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('Mutation.refreshTokens', () => {
    it('delegates to AuthService.refreshTokens with the token', async () => {
      const result = await authResolvers.Mutation.refreshTokens(null, { refreshToken: 'ref-token' }, mockContext as any);
      expect(MockedAuthService.prototype.refreshTokens).toHaveBeenCalledWith('ref-token');
      expect(result).toEqual(fakePayload);
    });
  });

  describe('Mutation.logout', () => {
    it('delegates to AuthService.logout with the token', async () => {
      const result = await authResolvers.Mutation.logout(null, { refreshToken: 'ref-token' }, mockContext as any);
      expect(MockedAuthService.prototype.logout).toHaveBeenCalledWith('ref-token');
      expect(result).toBe(true);
    });
  });
});
