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

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props) => <Text {...props}>{props.name}</Text>,
    Feather: (props) => <Text {...props}>{props.name}</Text>,
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-av for native audio playback testing
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setOnPlaybackStatusUpdate: jest.fn(),
          unloadAsync: jest.fn(),
        },
      }),
    },
  },
}));

/**
 * Mock expo-file-system
 *
 * WHY WE MOCK THIS:
 * expo-file-system is a native module. In Jest (Node environment) there are no
 * native modules — require('expo-file-system') would throw. The mock gives
 * tests a fake filesystem that behaves correctly (writeAsStringAsync resolves)
 * without touching disk.
 *
 * cacheDirectory and documentDirectory are fake path strings — tests that
 * call generateFilename() will produce paths like "file:///mock/cache/duka-deni-..."
 * which is fine because the test assertions don't check the exact path.
 */
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('{}'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('{}'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));

/**
 * Mock expo-sharing
 *
 * WHY WE MOCK THIS:
 * expo-sharing opens an Android/iOS native share sheet UI. In tests we just
 * want to verify that shareAsync is CALLED with the right arguments — not
 * that it actually opens a dialog. The mock resolves immediately.
 *
 * isAvailableAsync returns true so code paths guarded by availability checks
 * don't short-circuit during tests.
 */
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

