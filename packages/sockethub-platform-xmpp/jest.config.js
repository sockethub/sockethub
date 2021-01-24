module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  coverageThreshold: {
    global: {
      branches: 34,
      functions: 53,
      lines: 57,
      statements: 57
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};