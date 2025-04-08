import { arrayNode, rawNode, refNode, sql, valueNode, type SqlNode } from "@src/core/sql"
import { describe, expect, it } from "bun:test"

describe("sql", () => {

    const testCases : [SqlNode, string ][] = [
        [rawNode("\"FOO\""), "\"FOO\""],
        [refNode("FOO"), "\"FOO\""],
        [refNode("FOO", "bar"), "\"FOO\".\"bar\""],
        [refNode("'FOO'"), "\"'FOO'\""],
        [refNode("\"FOO\""), "\"\"\"FOO\"\"\""],
        [valueNode(123), "123"],
        [valueNode("123"), "'123'"],
        [valueNode(null), "NULL"],
        [arrayNode([1, 2, 3]), "ARRAY[1, 2, 3]"],
    ]

    for (const [input, expected] of testCases) {
        it(`${input.type}:${input.value} is expected to be ${expected}`, () => {
            expect(sql`${input}`).toBe(expected)
        })
    }

})
