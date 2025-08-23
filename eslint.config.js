// Temporary minimal ESLint flat config to satisfy pre-commit; extend later.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
export default [
  { ignores: ['built/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        localStorage: 'readonly',
        location: 'readonly'
      }
    },
    rules: {
      // Allow console for this simulation project
      'no-console': 'off'
    }
  }
]
