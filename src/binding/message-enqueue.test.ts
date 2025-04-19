import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { MessageStatus } from "@src/schema/message"
import { JobType } from "@src/schema/job"
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
    description: "nulled fields",
    channelName: "test-channel",
    payload: "test-payload",
    priority: null,
    channelPriority: null,
    name: null,
    numAttempts: 1,
    maxProcessingMs: 60,
    lockMs: 5,
    lockMsFactor: 2,
    delayMs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageEnqueue", async () => {
    it("correctly enqueues a message", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const enqueuedMessages = await pool.query(sql `
            SELECT * FROM test.message
        `)

        expect(enqueuedMessages.rowCount).toBe(1)
        expect(enqueuedMessages.rows[0]).toMatchObject({
            channel_name: messageParams.channelName,
            payload: messageParams.payload,
            priority: messageParams.priority,
            num_attempts: messageParams.numAttempts,
            max_processing_ms: messageParams.maxProcessingMs,
            lock_ms: messageParams.lockMs,
            lock_ms_factor: messageParams.lockMsFactor,
            is_processed: false,
            accepted_at: null,
            name: messageParams.name,
            status: MessageStatus.CREATED,
            id: firstEnqueueResult.messageId,
        })

        const enqueuedParams = await pool.query(sql `
                SELECT params FROM test.job
                WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            `)

        expect(enqueuedParams.rowCount).toBe(1)
        expect(enqueuedParams.rows[0].params).toMatchObject({
            id: enqueuedMessages.rows[0].id,
        })

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [firstEnqueueResult.messageId],
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")
    })

    it("rejects an enqueue if dependency is not found", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [firstEnqueueResult.messageId],
        })
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_DEPENDENCY_NOT_FOUND")
    })
})

