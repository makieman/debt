// jest.setup.js

// Force UTC timezone for consistent date/time test runs
process.env.TZ = 'UTC';

// Mock expo-sqlite so tests don't touch a real database
jest.mock('expo-sqlite', () => {
  return {
    openDatabaseSync: jest.fn(() => ({
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      execAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn((callback) => callback()),
    })),
  };
});

// Mock react-native-reanimated since it's a native dependency used in charts
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence reanimated worklet warnings
global.__reanimatedWorkletInit = () => {};
