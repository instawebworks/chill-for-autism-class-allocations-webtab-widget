import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Lint exists here for one specific reason, not for style.
 *
 * Vite does not type-check, so a reference to a name that does not exist —
 * `rosterFor(cls)` where `rosterFor` was never destructured — compiles cleanly,
 * ships, and throws only when a user reaches the line. That has happened twice
 * in this codebase. `no-undef` catches exactly that class of defect before it
 * leaves the machine, which is the whole justification for the dependency.
 *
 * The react-hooks rules earn their place for the same reason: the widget's two
 * worst bugs so far were both about effects and mount lifetimes.
 *
 * Formatting is deliberately not linted. Nothing here reformats code or argues
 * about quotes.
 */
export default [
  // `public/vendor` is Zoho's minified SDK, vendored deliberately and never
  // edited here. Linting someone else's build output tells us nothing.
  { ignores: ['dist/**', 'node_modules/**', 'public/vendor/**'] },

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The rule this whole config is here for.
      'no-undef': 'error',

      // Unused names are usually the other half of a rename that was only half
      // finished. Args are exempt when prefixed with _, which is the normal way
      // to say "required by the signature, not needed here".
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Deliberately not enabled: react-refresh/only-export-components. Every
      // provider here exports a Provider component beside its useX hook, which
      // the rule flags and which is the pattern the whole app is built on. A
      // warning that is wrong every time trains people to ignore the output.
    },
  },

  {
    // Node context, not browser.
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
