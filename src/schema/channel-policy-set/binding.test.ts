import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { channelPolicySet } from "@src/schema/channel-policy-set/binding"
import { sql } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { messageRelease } from "@src/schema/message-release/binding"

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
    name: null,
    numAttempts: 1,
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    dependsOn: [],
    delaySecs: 30,
}

describe("channelPolicySet", async () => {

    it("correctly sets null policy", async () => {
        await channelPolicySet({ 
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: null,
            maxSize: null
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].max_concurrency).toBeNull()
        expect(result.rows[0].max_size).toBeNull()
    })

    it("correctly sets invalid policy parameters", async () => {
        await channelPolicySet({ 
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 0,
            maxSize: -1
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].max_concurrency).toBe(1)
        expect(result.rows[0].max_size).toBe(1)
    })

    it("correctly overwrites policy parameters", async () => {
        await channelPolicySet({ 
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: 1,
            maxSize: 1
        })

        await channelPolicySet({ 
            databaseClient: pool,
            schema: "test",
            name: "foobar",
            maxConcurrency: null,
            maxSize: null
        })

        const result = await pool.query(sql `
            SELECT * FROM test.channel_policy
        `)

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].max_concurrency).toBeNull()
        expect(result.rows[0].max_size).toBeNull()

    })

    it("correctly overwrites state parameters", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        const initialState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])

        expect(initialState).toMatchObject({
            max_concurrency: null,
            max_size: null,
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



