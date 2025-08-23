// Temporary minimal ESLint flat config to satisfy pre-commit; extend later.
import js from '@eslint/js';
export default [
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // Allow console for this simulation project
      'no-console': 'off'
    }
  }
];
