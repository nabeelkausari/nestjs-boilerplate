import { Logger, LoggerService } from '@nestjs/common';

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
 * @param testingModuleBuilder - The testing module builder to configure
 * @returns The configured testing module builder
 */
export const disableLogging = (testingModuleBuilder: any): any => {
  return testingModuleBuilder
    .setLogger(silentLogger)
    .overrideProvider(Logger)
    .useValue(silentLogger);
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
