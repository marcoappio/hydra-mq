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
    numAttempts: 1,
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    dependsOn: [],
    deleteMs: 0,
    delayMs: 0
}

describe("channelPolicySet", async () => {

    it("correctly sets null policy", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: null,
            maxSize: null,
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].max_concurrency).toBeNull()
        expect(result.rows[0].max_size).toBeNull()
    })

    it("correctly overwrites policy parameters", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1,
            maxSize: null,
        })

        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: null,
            maxSize: 10
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].max_concurrency).toBeNull()
        expect(result.rows[0].max_size).toEqual(10)

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
            maxConcurrency: 1,
            maxSize: 2
        })

        const finalState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])

        expect(finalState).toMatchObject({
            max_concurrency: 1,
            max_size: 2,
        })

    })

})



