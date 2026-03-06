import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsPositive, Min } from 'class-validator';

@InputType()
export class CreateProductInput {
  @Field()
  @IsNotEmpty()
  name: string;

  @Field(() => Float)
  @IsPositive()
  price: number;

  @Field(() => Int)
  @Min(0)
  stock: number;
}
