module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
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