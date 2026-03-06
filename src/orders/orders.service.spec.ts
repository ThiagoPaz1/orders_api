import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';

const mockUser: User = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@example.com',
  created_at: new Date(),
};

const mockProduct: Product = {
  id: 'product-1',
  name: 'Widget',
  price: 10.0,
  stock: 5,
  created_at: new Date(),
};

function buildQueryRunner(overrides: Record<string, unknown> = {}) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    },
    ...overrides,
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let mockQueryRunner: ReturnType<typeof buildQueryRunner>;

  const mockOrdersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);

    mockQueryRunner = buildQueryRunner();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create an order and decrement stock', async () => {
      const product = { ...mockProduct, stock: 5 };
      const savedOrder = { id: 'order-1', total: 20, items: [] } as Order;

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockUser) // user lookup
        .mockResolvedValueOnce(product); // product lookup with lock

      mockQueryRunner.manager.save.mockResolvedValue(product);
      mockQueryRunner.manager.create.mockReturnValue({} as OrderItem);
      mockQueryRunner.manager.save.mockResolvedValueOnce(savedOrder);

      mockOrdersRepository.findOne.mockResolvedValue({
        ...savedOrder,
        user: mockUser,
        items: [],
      });

      const result = await service.create({
        userId: 'user-1',
        items: [{ productId: 'product-1', quantity: 2 }],
      });

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({
          userId: 'nonexistent-user',
          items: [{ productId: 'product-1', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      await expect(
        service.create({
          userId: 'user-1',
          items: [{ productId: 'nonexistent-product', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const lowStockProduct = { ...mockProduct, stock: 1 };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(lowStockProduct);

      await expect(
        service.create({
          userId: 'user-1',
          items: [{ productId: 'product-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject order when requested quantity equals stock exactly', async () => {
      const exactStockProduct = { ...mockProduct, stock: 3 };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(exactStockProduct);

      mockQueryRunner.manager.save.mockResolvedValue(exactStockProduct);
      const savedItem = {} as OrderItem;
      mockQueryRunner.manager.create.mockReturnValue(savedItem);
      mockQueryRunner.manager.save.mockResolvedValueOnce({
        id: 'order-2',
        total: 30,
      } as Order);
      mockOrdersRepository.findOne.mockResolvedValue({
        id: 'order-2',
        total: 30,
        user: mockUser,
        items: [savedItem],
      });

      const result = await service.create({
        userId: 'user-1',
        items: [{ productId: 'product-1', quantity: 3 }],
      });

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on unexpected error', async () => {
      mockQueryRunner.manager.findOne.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(
        service.create({
          userId: 'user-1',
          items: [{ productId: 'product-1', quantity: 1 }],
        }),
      ).rejects.toThrow('DB connection lost');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      const order = { id: 'order-1' } as Order;
      mockOrdersRepository.findOne.mockResolvedValue(order);
      const result = await service.findOne('order-1');
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
