import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a user', async () => {
    const input = { name: 'Alice', email: 'alice@example.com' };
    const user = { id: 'u-1', ...input, created_at: new Date() } as User;
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockReturnValue(user);
    mockRepository.save.mockResolvedValue(user);

    const result = await service.create(input);
    expect(result).toEqual(user);
  });

  it('should throw ConflictException for duplicate email', async () => {
    const existing = { id: 'u-1', email: 'alice@example.com' } as User;
    mockRepository.findOne.mockResolvedValue(existing);

    await expect(
      service.create({ name: 'Alice', email: 'alice@example.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should return all users', async () => {
    const users = [{ id: 'u-1' } as User];
    mockRepository.find.mockResolvedValue(users);
    const result = await service.findAll();
    expect(result).toEqual(users);
  });
});
