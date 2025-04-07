import { Queue } from "@src/queue"
import { randomUUID } from "crypto"
import { messageFinalize, type MessageFinalizeResultMessageFinalized } from "@src/schema/message-finalize/binding"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageEnqueue, type MessageEnqueueResult, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { messageRelease, type MessageReleaseResult } from "@src/schema/message-release/binding"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/schema/message-dequeue/binding"
import { sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

const messageParams = {
    channelName: "test-channel",
    payload: "test-payload",
    priority: null,
    name: null,
    numAttempts: 1,
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    delaySecs: 0,
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
            id: randomUUID(),
            isSuccess: false
        })
        expect(result.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("deletes messages correctly", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            dependsOn: [enqueueResult.messageId]
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        }) as MessageReleaseResult
        expect(releaseResult.resultType).toBe("MESSAGE_RELEASED")

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(dequeueResult.message.id).toBe(enqueueResult.messageId)

        const finalizeResult = await messageFinalize({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            isSuccess: false
        }) as MessageFinalizeResultMessageFinalized
        expect(finalizeResult.resultType).toBe("MESSAGE_FINALIZED")

        const jobs = await pool.query(sql`
            SELECT * FROM test.job_message_dependency_resolve_params
        `).then(res => res.rows)
        expect(jobs.length).toBe(1)
        expect(jobs[0].message_id).toBe(secondEnqueueResult.messageId)

        const dependencies = await pool.query(sql`
            SELECT COUNT(*) as num_rows FROM test.message_dependency
        `).then(res => res.rows[0])
        expect(parseInt(dependencies.num_rows)).toBe(0)
    })



})
