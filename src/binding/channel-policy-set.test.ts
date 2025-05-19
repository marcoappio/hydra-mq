import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { channelPolicySet } from "@src/binding/channel-policy-set"
import { sql } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageRelease } from "@src/binding/message-release"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

const messageParams = {
    channelName: "foobar",
    payload: "test-payload",
    priority: null,
    channelPriority: null,
    name: null,
    maxProcessingMs: 60_000,
    delayMs: 0
}

describe("channelPolicySet", async () => {

    it("correctly overwrites policy parameters", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1,
        })

        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 2,
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0]).toMatchObject({ max_concurrency: 2 })
    })

    it("correctly overwrites state parameters", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        const initialState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])

        expect(initialState).toMatchObject({
            max_concurrency: null,
        })

        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1
        })

        const finalState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])

        expect(finalState).toMatchObject({
            max_concurrency: 1
        })

    })

})



