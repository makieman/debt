module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    './jest.setup.js'
  ],
  transformIgnorePatterns: [
    'node_modules/@react-native/jest-preset/jest/react-native-env.js',
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|victory-native|@shopify/react-native-skia|react-native-reanimated|react-native-gesture-handler)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/types/**'
  ]
};
