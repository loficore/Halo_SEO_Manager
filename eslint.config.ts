import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        module: 'writable',
        NodeJS: 'readonly',
      },
    },
  },
  tseslint.configs.recommended,
  js.configs.recommended,
  {
    ignores: [
      'node_modules',
      'dist',
      '.eslintrc.cjs',
      'eslint.config.ts',
      '*.js',
    ],
  },
]);
