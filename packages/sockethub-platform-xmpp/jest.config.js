module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  coverageThreshold: {
    global: {
      branches: 34,
      functions: 53,
      lines: 59,
      statements: 58
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};