import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist', '**/dist-types', '**/coverage', '**/node_modules', 'docs'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // A calendar day from toISOString() is the UTC date: wrong near midnight
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message: 'toISOString() gives the UTC date. Use the local-date helpers.',
        },
      ],
    },
  },
  {
    files: [
      '*.config.{js,ts}',
      '**/vite.config.ts',
      'scripts/**',
      'e2e-trial/**',
      'playwright.config.ts',
      'apps/web/e2e/**',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
