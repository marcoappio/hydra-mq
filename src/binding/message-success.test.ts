import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { messageRelease, type MessageReleaseResult } from "@src/binding/message-release"
import { messageDequeue, type MessageDequeueResult } from "@src/binding/message-dequeue"
import { MessageStatus } from "@src/schema/message"
import { JobType } from "@src/schema/job"
import { messageSuccess, type MessageSuccessResult } from "@src/binding/message-success"

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
    numAttempts: 1,
    maxProcessingMs: 60,
    lockMs: 2,
    lockMsFactor: 2,
    delayMs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageSuccess", async () => {
    it("correct reports on missing message", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        }) as MessageEnqueueResultMessageEnqueued

        const rejectResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(rejectResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("correctly completes messages", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 2,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        }) as MessageReleaseResult
        expect(releaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResult
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const channelStatePreSuccess = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(testMessageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelStatePreSuccess).toMatchObject({
            current_size: 1,
            current_concurrency: 1,
        })

        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        }) as MessageSuccessResult
        expect(successResult.resultType).toBe("MESSAGE_COMPLETED")

        const channelStatePostSuccess = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(testMessageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelStatePostSuccess).toMatchObject({
            current_size: 0,
            current_concurrency: 0,
        })

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.COMPLETED)

        const numFinalizeJobs = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rowCount)
        expect(numFinalizeJobs).toEqual(1)

    })
})


