import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './product.entity';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a product', async () => {
    const input = { name: 'Widget', price: 9.99, stock: 100 };
    const product = { id: 'p-1', ...input, created_at: new Date() } as Product;
    mockRepository.create.mockReturnValue(product);
    mockRepository.save.mockResolvedValue(product);

    const result = await service.create(input);
    expect(result).toEqual(product);
  });

  it('should return all products', async () => {
    const products = [{ id: 'p-1' } as Product];
    mockRepository.find.mockResolvedValue(products);
    const result = await service.findAll();
    expect(result).toEqual(products);
  });

  it('should return a product by id', async () => {
    const product = { id: 'p-1' } as Product;
    mockRepository.findOne.mockResolvedValue(product);
    const result = await service.findOne('p-1');
    expect(result).toEqual(product);
  });

  it('should throw NotFoundException when product not found', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
