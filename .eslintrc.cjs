module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  parserOptions: {
    project: './tsconfig.json'
  },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Identifier[name="any"]',
        message: 'Use tipos explícitos e seguros.'
      }
    ]
  }
};
