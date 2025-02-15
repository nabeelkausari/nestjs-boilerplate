import { Logger, LoggerService } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';

/**
 * A silent logger service that does nothing
 */
export const silentLogger: LoggerService = {
  log: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  verbose: () => {},
  fatal: () => {},
};

/**
 * Configures a testing module to disable all logging
 * @param moduleRef - The testing module to configure
 * @returns The configured testing module
 */
export const disableLogging = async (
  moduleRef: TestingModule,
): Promise<TestingModule> => {
  moduleRef.useLogger(silentLogger);
  return moduleRef;
};

/**
 * Sets up global logging configuration for tests
 * Should be called in beforeAll
 */
export const setupTestLogging = (): void => {
  Logger.overrideLogger([]);
};

/**
 * Restores global logging configuration
 * Should be called in afterAll
 */
export const restoreTestLogging = (): void => {
  Logger.overrideLogger(undefined);
};
