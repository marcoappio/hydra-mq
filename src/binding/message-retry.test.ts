import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageRetry } from "@src/binding/message-retry"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue }  from "@src/binding/message-dequeue"
import { MessageStatus } from "@src/schema/enum/message-status"
import { JobType } from "@src/schema/enum/job-type"
import { randomUUID } from "crypto"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

const testMessageParams = {
    channelName: "test-channel",
    payload: "test-payload",
    priority: null,
    channelPriority: null,
    name: null,
    maxProcessingMs: 60_000,
    delayMs: 0
}

describe("messageRetry", async () => {
    it("reports when message not found", async () => {
        const retryResult = await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: randomUUID()
        })
        expect(retryResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports message with invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        })

        const retryResult = await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: createResult.id
        })
        expect(retryResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("continually increments numAttempts", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            priority: 1337
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: createResult.id
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: createResult.id
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: createResult.id
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.ACCEPTED,
            num_attempts: 3
        })
    })

    it("correctly locks messages when lockMs > 0", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const retryResult = await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 1,
            id: createResult.id,
        })
        expect(retryResult.resultType).toBe("MESSAGE_LOCKED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: testMessageParams.channelName,
            current_size: 1,
            next_message_id: null,
            next_priority: null,
            current_concurrency: 0,
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.LOCKED,
            num_attempts: 1
        })

        const lockParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rows[0].params)
        expect(lockParams).toMatchObject({ id: createResult.id })
    })

    it("correctly accepts messages when lockMs = 0", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            priority: 1337
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const retryResult = await messageRetry({
            databaseClient: pool,
            schema: "test",
            lockMs: 0,
            id: createResult.id
        })
        expect(retryResult.resultType).toBe("MESSAGE_ACCEPTED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: testMessageParams.channelName,
            next_message_id: createResult.id,
            next_priority: 1337,
            current_size: 1,
            current_concurrency: 0,
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.ACCEPTED,
            num_attempts: 1
        })
    })
})


