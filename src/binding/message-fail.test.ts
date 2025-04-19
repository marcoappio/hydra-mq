import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { messageFail } from "@src/binding/message-fail"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue }  from "@src/binding/message-dequeue"
import { MessageStatus } from "@src/schema/message"
import { JobType } from "@src/schema/job"

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

describe("messageFail", async () => {
    it("correct reports on missing message", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        }) as MessageEnqueueResultMessageEnqueued

        const rejectResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            exhaust: false
        })
        expect(rejectResult.resultType).toBe("MESSAGE_NOT_FOUND")

    })

    it("correctly locks messages when attempts are remaining", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 2,
        }) as MessageEnqueueResultMessageEnqueued

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const dequeueResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            exhaust: false
        })
        expect(dequeueResult.resultType).toBe("MESSAGE_LOCKED")

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.LOCKED)

        const lockParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rows[0].params)
        expect(lockParams).toMatchObject({ id: enqueueResult.messageId })

        const numFinalizeJobs = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rowCount)
        expect(numFinalizeJobs).toEqual(0)

    })

    it("correctly exhausts messages when exhaust is forced", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 10,
        }) as MessageEnqueueResultMessageEnqueued

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(releaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            exhaust: true
        })
        expect(failResult.resultType).toBe("MESSAGE_EXHAUSTED")

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.EXHAUSTED)

        const finalizeParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rows[0].params)
        expect(finalizeParams).toMatchObject({ id: enqueueResult.messageId })

        const numUnlockJobs = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rowCount)
        expect(numUnlockJobs).toEqual(0)

    })

    it("correctly exhausts messages when no attempts are remaining", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        }) as MessageEnqueueResultMessageEnqueued

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const dequeueResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            exhaust: false
        })
        expect(dequeueResult.resultType).toBe("MESSAGE_EXHAUSTED")

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.EXHAUSTED)

        const finalizeParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rows[0].params)
        expect(finalizeParams).toMatchObject({ id: enqueueResult.messageId })

        const numUnlockJobs = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rowCount)
        expect(numUnlockJobs).toEqual(0)

    })
})


