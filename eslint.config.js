import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// A calendar day from toISOString() is the UTC date: wrong near midnight
const noIsoDay = {
  selector:
    "CallExpression[callee.property.name=/^(slice|substring|substr|split)$/][callee.object.callee.property.name='toISOString']",
  message: 'toISOString() gives the UTC date. Use the local-date helpers.',
};

// Screens are built from the kit (packages/ui) only: no raw controls, no own overlays, no browser dialogs
const rawControls = {
  selector: 'JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog|form|a)$/]',
  message:
    'Screens use the kit components (@auratrack/ui), not raw <button>, <input>, <select>, <textarea>, <dialog>, <form> or <a>.',
};
const ownOverlays = {
  selector: "Property[key.name=/^(position|zIndex)$/][value.value=/^(fixed|sticky)$/], Property[key.name='zIndex']",
  message:
    'Overlays and layers come from the kit (BottomSheet, Dialog, ToastProvider). Screens set no position: fixed or z-index.',
};
const browserDialogs = {
  selector:
    "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/], CallExpression[callee.name=/^(alert|confirm|prompt)$/]",
  message: 'Use the kit Dialog, not the browser alert, confirm or prompt.',
};
const noIsoAtAll = {
  selector: "MemberExpression[property.name='toISOString']",
  message: 'Screens never need toISOString(): days come from the local-date helpers, moments are stored as numbers.',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/dist-types',
      '**/coverage',
      '**/node_modules',
      '**/.stryker-tmp',
      'reports',
      'docs',
      'apps/web/public',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': ['error', noIsoDay],
    },
  },
  {
    // Product screens (everything in the app except the developer page and the tests)
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/dev/**', 'apps/web/src/main.tsx', '**/*.test.tsx'],
    rules: { 'no-restricted-syntax': ['error', noIsoDay, noIsoAtAll, rawControls, ownOverlays, browserDialogs] },
  },
  {
    // Tests read values they have just written: a non-null assertion there is the clearer form
    files: ['**/*.test.{ts,tsx}', 'apps/web/e2e/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: [
      '*.config.{js,ts}',
      '**/vite.config.ts',
      'scripts/**',
      'apps/*/scripts/**',
      'e2e-trial/**',
      'playwright.config.ts',
      'apps/web/e2e/**',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
);
