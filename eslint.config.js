import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // supabase/functions : runtime Deno (imports jsr:/https:, global Deno) — outillage
  // et lint propres (deno check), hors du périmètre ESLint navigateur de l'app.
  // runner/ (Node : BullMQ, service_role) et supabase/functions (Deno) ont leur
  // propre validation — tsc -p runner/tsconfig.json / deno — hors ESLint navigateur.
  { ignores: ['dist', 'supabase/functions', 'runner'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);
