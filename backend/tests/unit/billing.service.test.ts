import { PrismaClient } from '@prisma/client';

// Set env vars before module load
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.STRIPE_PRICE_PRO = 'price_pro_test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

const mockStripe = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));

import { BillingService } from '../../src/extensions/billing-stripe/billing.service';

const mockDb = {
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    update: jest.fn(),
  },
  plan: {
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new BillingService(mockDb);

describe('BillingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createCheckoutSession', () => {
    it('throws when unknown planId is provided', async () => {
      await expect(
        service.createCheckoutSession('ws-1', 'unknown_plan', 'https://success.com', 'https://cancel.com'),
      ).rejects.toThrow('No Stripe price configured for plan: unknown_plan');
    });

    it('creates stripe customer when none exists and returns session URL', async () => {
      (mockDb.subscription.findUnique as jest.Mock).mockResolvedValue({
        stripeCustomerId: null,
        workspace: { name: 'Test WS' },
        workspaceId: 'ws-1',
      });
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
      (mockDb.subscription.update as jest.Mock).mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/test',
      });

      const result = await service.createCheckoutSession(
        'ws-1',
        'pro',
        'https://success.com',
        'https://cancel.com',
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ workspaceId: 'ws-1' }),
        }),
      );
      expect(mockDb.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stripeCustomerId: 'cus_new' },
        }),
      );
      expect(result).toBe('https://checkout.stripe.com/pay/test');
    });

    it('reuses existing stripeCustomerId without creating a new customer', async () => {
      (mockDb.subscription.findUnique as jest.Mock).mockResolvedValue({
        stripeCustomerId: 'cus_existing',
        workspace: { name: 'Test WS' },
        workspaceId: 'ws-1',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/existing',
      });

      const result = await service.createCheckoutSession(
        'ws-1',
        'pro',
        'https://success.com',
        'https://cancel.com',
      );

      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(result).toBe('https://checkout.stripe.com/pay/existing');
    });
  });

  describe('handleWebhook', () => {
    it('throws when signature verification fails', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(Buffer.from('payload'), 'invalid-sig'),
      ).rejects.toThrow('Webhook signature verification failed');
    });
  });
});
