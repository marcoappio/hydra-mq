import { sql } from '@src/core/sql'
import { expect, test } from 'bun:test'

test('sql.build', () => {

    expect(sql.build `${sql.raw('"FOO"')}`).toEqual('"FOO"')

    expect(sql.build `${sql.ref('FOO')}`).toEqual('"FOO"')
    expect(sql.build `${sql.ref('\'FOO\'')}`).toEqual('"\'FOO\'"')
    expect(sql.build `${sql.ref('"FOO"')}`).toEqual('"""FOO"""')

    expect(sql.build `${sql.value(123)}`).toEqual('123')
    expect(sql.build `${sql.value('123')}`).toEqual('\'123\'')
    expect(sql.build `${sql.value(null)}`).toEqual('NULL')

    expect(sql.build `${sql.array([1, 2, 3])}`).toEqual('ARRAY[1, 2, 3]')

})
