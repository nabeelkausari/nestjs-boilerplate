import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from './models/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AbstractRepository } from '@app/common';

@Injectable()
export class UsersRepository extends AbstractRepository<UserDocument> {
  protected readonly logger = new Logger(UsersRepository.name);

  constructor(@InjectModel(UserDocument.name) userModel: Model<UserDocument>) {
    super(userModel);
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const user = new this.model(createUserDto);
    return user.save();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.model.find().exec();
  }

  async findById(id: string | Types.ObjectId): Promise<UserDocument> {
    return this.model.findById(id).exec();
  }

  async findOne(query: any): Promise<UserDocument> {
    return this.model.findOne(query).exec();
  }

  async update(
    id: string | Types.ObjectId,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.model
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
  }

  async delete(id: string | Types.ObjectId): Promise<UserDocument> {
    return this.model.findByIdAndDelete(id).exec();
  }
}
