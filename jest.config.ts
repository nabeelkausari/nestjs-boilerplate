export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/', '<rootDir>/apps/'],
  moduleNameMapper: {
    '^@app/common(.*)$': '<rootDir>/libs/common/src$1',
    '^@app/(.*)$': '<rootDir>/apps/$1',
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['jest-extended'],
  forceExit: true,
  detectOpenHandles: true,
};
