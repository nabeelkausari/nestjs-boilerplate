import { FilterQuery, Model, UpdateQuery, ClientSession } from 'mongoose';
import { Logger, NotFoundException } from '@nestjs/common';
import { AbstractSchema } from './abstract.schema';

export abstract class AbstractRepository<TDocument extends AbstractSchema> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly model: Model<TDocument>) {}

  async startTransaction(): Promise<ClientSession> {
    const session = await this.model.db.startSession();
    session.startTransaction();
    return session;
  }

  async create(
    document: Omit<TDocument, '_id' | 'createdAt' | 'updatedAt'>,
    options?: { session?: ClientSession },
  ): Promise<TDocument> {
    const createdDocument = new this.model({
      ...document,
    });
    return createdDocument
      .save(options)
      .then((doc) => doc.toJSON() as TDocument);
  }

  async findOne(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<TDocument> {
    const document = await this.model
      .findOne(filterQuery, null, options)
      .lean<TDocument>(true);
    if (!document) {
      this.logger.warn('Document not found with filterQuery', filterQuery);
      throw new NotFoundException('Document not found.');
    }
    return document;
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
    options: { new?: boolean; session?: ClientSession; upsert?: boolean } = {
      new: true,
    },
  ): Promise<TDocument> {
    const document = await this.model
      .findOneAndUpdate(filterQuery, update, {
        new: true,
        upsert: options.upsert,
        ...options,
      })
      .lean<TDocument>();

    if (!document && !options.upsert) {
      this.logger.warn('Document not found with filterQuery', filterQuery);
      throw new NotFoundException('Document not found.');
    }

    return document as TDocument;
  }

  async find(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<TDocument[]> {
    return this.model.find(filterQuery, null, options).lean<TDocument[]>(true);
  }

  async deleteOne(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<TDocument | null> {
    const document = await this.model.findOneAndDelete(filterQuery, options);
    return document ? (document as any).toJSON() : null;
  }

  async deleteAll(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<TDocument[]> {
    return this.model.deleteMany(filterQuery, options).lean<TDocument[]>(true);
  }

  async findOneOrNull(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<TDocument | null> {
    const document = await this.model
      .findOne(filterQuery, null, options)
      .lean<TDocument>(true);
    return document;
  }
}
