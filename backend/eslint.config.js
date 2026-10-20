// Revision automatica de calidad del codigo del backend (`npm run lint`). Reglas recomendadas de ESLint +
// unas pocas propias del proyecto. Es CommonJS (require/module.exports) y corre en Node.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'certs/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Variables sin usar: error, salvo las que empiezan con _ (convencion para "no lo uso a proposito").
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-console': 'off', // el API y los scripts informan por consola
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Pruebas Jest: anade las funciones globales de Jest.
    files: ['**/*.test.js', 'src/test-utils/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
