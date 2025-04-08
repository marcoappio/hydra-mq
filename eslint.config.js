import stylisticPlugin from '@stylistic/eslint-plugin-ts'
import typescriptPlugin from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'

export default {
    files: ['**/*.ts'],
    ignores: ['src/core/database/gen.ts'],
    languageOptions: { parser },
    plugins: {
        '@stylistic/ts': stylisticPlugin,
        '@typescript-eslint': typescriptPlugin,
    },
    rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        'eol-last': ['warn', 'always'],
        'indent': ['warn', 4],
        'quotes': ['warn', 'double'],
        'semi': ['warn', 'never'],
        'no-console': 'warn',
        'space-in-parens': ['warn', 'never'],
        'no-trailing-spaces': 'warn',
        'comma-spacing': 'warn',
        'space-before-blocks': 'warn',
        'keyword-spacing': 'warn',
    },
}
