export default {
  'apps/web/**/*.{js,jsx,ts,tsx}': [
    'pnpm --filter web exec eslint --fix',
    'prettier --write',
  ],
  'apps/api/**/*.{js,jsx,ts,tsx}': [
    'pnpm --filter api exec eslint --fix',
    'prettier --write',
  ],
  '*.{json,jsonc,css,md,yml,yaml}': 'prettier --write',
};
