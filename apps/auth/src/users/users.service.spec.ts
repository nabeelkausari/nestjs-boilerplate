import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './models/user.schema';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const mockUser: UserDocument = {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    password: 'hashed_password',
    roles: ['user'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserDocument;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        password: 'password123',
        roles: ['user'],
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createUserDto.email,
          password: expect.any(String),
          roles: createUserDto.roles,
        }),
      );
    });

    it('should throw UnprocessableEntityException if user exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
        roles: ['user'],
      };

      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      repository.findAll.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(repository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser._id);

      expect(result).toEqual(mockUser);
      expect(repository.findById).toHaveBeenCalledWith(mockUser._id);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = {
        roles: ['admin'],
      };

      const updatedUser = { ...mockUser, ...updateUserDto };
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser._id, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(repository.update).toHaveBeenCalledWith(
        mockUser._id,
        updateUserDto,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(new Types.ObjectId().toString(), { roles: ['admin'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.delete.mockResolvedValue(mockUser);

      const result = await service.remove(mockUser._id);

      expect(result).toEqual(mockUser);
      expect(repository.delete).toHaveBeenCalledWith(mockUser._id);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.remove(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
