import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { channelPolicySet } from "@src/binding/channel-policy-set"
import { sql } from "@src/core/sql"
import { channelPolicyClear } from "@src/binding/channel-policy-clear"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

describe("channelPolicyClear", async () => {

    it("is a noop for missing channel policy", async () => {
        await channelPolicyClear({
            databaseClient: pool,
            schema: "test",
            name: "foobar"
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)
        expect(result.rows.length).toBe(0)
    })

    it("doesn't remove other channel policies", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1,
            maxSize: 1,
        })

        let result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)

        await channelPolicyClear({
            databaseClient: pool,
            schema: "test",
            name: "other"
        })

        result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)

    })

    it("removes specified channel policy", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1,
            maxSize: 2
        })

        let result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)

        await channelPolicyClear({
            databaseClient: pool,
            schema: "test",
            name: "foobar"
        })

        result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(0)
    })

})



