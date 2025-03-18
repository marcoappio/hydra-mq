import { arrayNode, rawNode, refNode, sql, valueNode } from "@src/core/sql"
import { expect, test } from "bun:test"

test("sql.build", () => {

    expect(sql `${rawNode("\"FOO\"")}`).toEqual("\"FOO\"")

    expect(sql `${refNode("FOO")}`).toEqual("\"FOO\"")
    expect(sql `${refNode("'FOO'")}`).toEqual("\"'FOO'\"")
    expect(sql `${refNode("\"FOO\"")}`).toEqual("\"\"\"FOO\"\"\"")

    expect(sql `${valueNode(123)}`).toEqual("123")
    expect(sql `${valueNode("123")}`).toEqual("'123'")
    expect(sql `${valueNode(null)}`).toEqual("NULL")

    expect(sql `${arrayNode([1, 2, 3])}`).toEqual("ARRAY[1, 2, 3]")

})
