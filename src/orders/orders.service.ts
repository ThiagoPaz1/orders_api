import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { CreateOrderInput } from './dto/create-order.input';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: input.userId },
      });
      if (!user) {
        throw new NotFoundException(`User ${input.userId} not found`);
      }

      const orderItems: OrderItem[] = [];
      let total = 0;

      // Sort IDs to avoid deadlocks when acquiring locks on multiple rows
      const sortedItems = [...input.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      for (const itemInput of sortedItems) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: itemInput.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product ${itemInput.productId} not found`);
        }

        if (product.stock < itemInput.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${itemInput.quantity}`,
          );
        }

        product.stock -= itemInput.quantity;
        await queryRunner.manager.save(Product, product);

        const item = queryRunner.manager.create(OrderItem, {
          product,
          quantity: itemInput.quantity,
          price: Number(product.price),
        });
        orderItems.push(item);
        total += Number(product.price) * itemInput.quantity;
      }

      const order = queryRunner.manager.create(Order, {
        user,
        total,
        items: orderItems,
      });

      const saved = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order created: ${saved.id} for user ${user.id}, total: ${total}`,
      );

      return this.ordersRepository.findOne({
        where: { id: saved.id },
        relations: ['user', 'items', 'items.product'],
      }) as Promise<Order>;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Order creation failed: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  findAll(): Promise<Order[]> {
    return this.ordersRepository.find({
      relations: ['user', 'items', 'items.product'],
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
