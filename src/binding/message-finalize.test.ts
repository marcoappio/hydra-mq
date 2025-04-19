import { Queue } from "@src/queue"
import { randomUUID } from "crypto"
import { messageFinalize } from "@src/binding/message-finalize"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/binding/message-dequeue"
import { sql, valueNode } from "@src/core/sql"
import { messageSuccess } from "@src/binding/message-success"
import { JobType } from "@src/schema/job"
import { channelPolicySet } from "@src/binding/channel-policy-set"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

const messageParams = {
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

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

describe("messageFinalize", async () => {

    it("correctly reports no messages available", async () => {
        const result = await messageFinalize({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(result.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("doesn't delete channel state when non-empty", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test"
        }) as MessageDequeueResultMessageDequeued
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(successResult.resultType).toBe("MESSAGE_COMPLETED")

        const finalizeResult = await messageFinalize({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(finalizeResult.resultType).toBe("MESSAGE_DELETED")

        const numMessageRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.message
        `).then(res => Number(res.rows[0].num_rows))
        expect(numMessageRows).toBe(1)

        const channelState = await pool.query(sql`
            SELECT current_size, current_concurrency FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 1,
            current_concurrency: 0
        })
    })

    it("correctly finalizes completed messages", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const otherEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            channelName: "OTHER",
            dependsOn: [enqueueResult.messageId]
        }) as MessageEnqueueResultMessageEnqueued
        expect(otherEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(releaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test"
        }) as MessageDequeueResultMessageDequeued
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(successResult.resultType).toBe("MESSAGE_COMPLETED")

        const finalizeResult = await messageFinalize({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(finalizeResult.resultType).toBe("MESSAGE_DELETED")

        const numMessageRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.message
        `).then(res => Number(res.rows[0].num_rows))
        expect(numMessageRows).toBe(1)

        const numChannelRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.channel_state
        `).then(res => Number(res.rows[0].num_rows))
        expect(numChannelRows).toBe(0)

        const job = await pool.query(sql`
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)}
        `).then(res => res.rows[0])
        expect(job.params).toMatchObject({
            id: otherEnqueueResult.messageId,
            is_success: true
        })
    })

    it("correctly finalizes dropped messages", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const otherEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            channelName: "OTHER",
            dependsOn: [enqueueResult.messageId]
        }) as MessageEnqueueResultMessageEnqueued
        expect(otherEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: messageParams.channelName,
            maxSize: 0,
            maxConcurrency: null
        })

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(releaseResult.resultType).toBe("MESSAGE_DROPPED")

        const finalizeResult = await messageFinalize({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(finalizeResult.resultType).toBe("MESSAGE_DELETED")

        const numMessageRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.message
        `).then(res => Number(res.rows[0].num_rows))
        expect(numMessageRows).toBe(1)

        const job = await pool.query(sql`
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)}
        `).then(res => res.rows[0])
        expect(job.params).toMatchObject({
            id: otherEnqueueResult.messageId,
            is_success: false
        })
    })




})
