import coreWebVitalsConfig from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

import tseslint from 'typescript-eslint';

const eslintConfig = tseslint.config(
  ...coreWebVitalsConfig,
  ...typescriptConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  { files: ['**/*.{js,mjs}'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
    ],
    ignores: ['lib/prisma.ts', 'lib/auth/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/prisma',
              message:
                'Prisma is server-only — read via prisma/data/, write via prisma/actions/.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'prisma/client/**',
      '.claude/**',
      '.temp/**',
      'tsconfig.tsbuildinfo',
    ],
  },
);

export default eslintConfig;
