import { DodService } from '../../src/modules/definition-of-done/dod.service';
import { PrismaClient } from '@prisma/client';

const mockDb = {
  dodItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

const service = new DodService(mockDb);

describe('DodService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('calls findFirst to get last order and creates item with order + 1', async () => {
      (mockDb.dodItem.findFirst as jest.Mock).mockResolvedValue({ order: 4 });
      const mockItem = { id: 'dod-1', projectId: 'proj-1', text: 'All tests pass', order: 5 };
      (mockDb.dodItem.create as jest.Mock).mockResolvedValue(mockItem);

      const result = await service.create('proj-1', 'All tests pass');

      expect(mockDb.dodItem.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { order: 'desc' },
      });
      expect(mockDb.dodItem.create).toHaveBeenCalledWith({
        data: { projectId: 'proj-1', text: 'All tests pass', order: 5 },
      });
      expect(result).toBe(mockItem);
    });

    it('creates item with order 0 when no existing items', async () => {
      (mockDb.dodItem.findFirst as jest.Mock).mockResolvedValue(null);
      const mockItem = { id: 'dod-1', projectId: 'proj-1', text: 'First item', order: 0 };
      (mockDb.dodItem.create as jest.Mock).mockResolvedValue(mockItem);

      await service.create('proj-1', 'First item');

      expect(mockDb.dodItem.create).toHaveBeenCalledWith({
        data: { projectId: 'proj-1', text: 'First item', order: 0 },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundError when item not found', async () => {
      (mockDb.dodItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent-id', 'New text')).rejects.toThrow(
        'DodItem no encontrado',
      );
    });

    it('updates text when item is found', async () => {
      const existingItem = { id: 'dod-1', projectId: 'proj-1', text: 'Old text', order: 0 };
      const updatedItem = { ...existingItem, text: 'New text' };
      (mockDb.dodItem.findUnique as jest.Mock).mockResolvedValue(existingItem);
      (mockDb.dodItem.update as jest.Mock).mockResolvedValue(updatedItem);

      const result = await service.update('dod-1', 'New text');

      expect(mockDb.dodItem.update).toHaveBeenCalledWith({
        where: { id: 'dod-1' },
        data: { text: 'New text' },
      });
      expect(result).toBe(updatedItem);
    });
  });

  describe('delete', () => {
    it('calls db.dodItem.delete and returns true', async () => {
      (mockDb.dodItem.delete as jest.Mock).mockResolvedValue({});

      const result = await service.delete('dod-1');

      expect(mockDb.dodItem.delete).toHaveBeenCalledWith({ where: { id: 'dod-1' } });
      expect(result).toBe(true);
    });
  });

  describe('reorder', () => {
    it('calls update for each id with correct order index', async () => {
      const orderedIds = ['dod-3', 'dod-1', 'dod-2'];
      (mockDb.dodItem.update as jest.Mock).mockResolvedValue({});
      (mockDb.dodItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.reorder('proj-1', orderedIds);

      expect(mockDb.dodItem.update).toHaveBeenCalledTimes(3);
      expect(mockDb.dodItem.update).toHaveBeenNthCalledWith(1, { where: { id: 'dod-3' }, data: { order: 0 } });
      expect(mockDb.dodItem.update).toHaveBeenNthCalledWith(2, { where: { id: 'dod-1' }, data: { order: 1 } });
      expect(mockDb.dodItem.update).toHaveBeenNthCalledWith(3, { where: { id: 'dod-2' }, data: { order: 2 } });
    });
  });

  describe('getItems', () => {
    it('calls findMany with correct projectId', async () => {
      const mockItems = [
        { id: 'dod-1', projectId: 'proj-1', text: 'Item 1', order: 0 },
        { id: 'dod-2', projectId: 'proj-1', text: 'Item 2', order: 1 },
      ];
      (mockDb.dodItem.findMany as jest.Mock).mockResolvedValue(mockItems);

      const result = await service.getItems('proj-1');

      expect(mockDb.dodItem.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { order: 'asc' },
      });
      expect(result).toBe(mockItems);
    });
  });
});
