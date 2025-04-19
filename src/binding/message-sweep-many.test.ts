import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/binding/message-release"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { messageSweepMany } from "@src/binding/message-sweep-many"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/binding/message-dequeue"
import { sql, valueNode } from "@src/core/sql"
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
    delayMs: 30,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageSweepMany", async () => {

    it("correctly returns an empty array when theres nothing to sweep", async () => {
        const result = await messageSweepMany({
            databaseClient: pool,
            schema: "test"
        })
        expect(result.ids).toBeArrayOfSize(0)

        const numRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FAIL)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numRows).toBe(0)
    })

    it("correctly returns an empty array if jobs are not yet stalled", async () => {

        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const firstDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const result = await messageSweepMany({
            databaseClient: pool,
            schema: "test"
        })
        expect(result.ids).toBeArrayOfSize(0)

        const numRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FAIL)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numRows).toBe(0)

    })

    it("correctly handles stalled jobs", async () => {

        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            maxProcessingMs: 0,
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const firstDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")

        const result = await messageSweepMany({
            databaseClient: pool,
            schema: "test"
        })
        expect(result.ids).toEqual([firstEnqueueResult.messageId])

        const numRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FAIL)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numRows).toBe(1)


    })
})



