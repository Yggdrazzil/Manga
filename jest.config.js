// Configuration Jest sortie de package.json pour pouvoir ÉTENDRE la table de
// transformation du préréglage jest-expo au lieu de la remplacer.
//
// Le préréglage ne transforme que `\.[jt]sx?$`, ce qui laisse de côté les
// modules ESM d'outillage (scripts/*.mjs). Sans cet ajout, importer
// scripts/synopsis-guard.mjs depuis un test échoue sur « Unexpected token
// 'export' ».
const preset = require('jest-expo/jest-preset');

const babelWithMetroCaller = [
  'babel-jest',
  { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } },
];

module.exports = {
  ...preset,
  transform: {
    ...preset.transform,
    '^.+\\.mjs$': babelWithMetroCaller,
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  testEnvironment: 'node',
  moduleNameMapper: {
    ...(preset.moduleNameMapper ?? {}),
    '^@/(.*)$': '<rootDir>/$1',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|moti|@motify/.*|zustand)',
  ],
};
