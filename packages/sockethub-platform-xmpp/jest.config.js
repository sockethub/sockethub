module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};