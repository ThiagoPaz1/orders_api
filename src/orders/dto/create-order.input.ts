import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsUUID, IsArray, ArrayMinSize, IsPositive } from 'class-validator';

@InputType()
export class OrderItemInput {
  @Field(() => ID)
  @IsUUID()
  productId: string;

  @Field(() => Int)
  @IsPositive()
  quantity: number;
}

@InputType()
export class CreateOrderInput {
  @Field(() => ID)
  @IsUUID()
  userId: string;

  @Field(() => [OrderItemInput])
  @IsArray()
  @ArrayMinSize(1)
  items: OrderItemInput[];
}
