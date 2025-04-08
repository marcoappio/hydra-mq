import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { messageLock } from "@src/schema/message-lock/binding"
import { messageRelease } from "@src/schema/message-release/binding"
import { messageDequeue } from "@src/schema/message-dequeue/binding"
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
    maxProcessingSecs: 60,
    lockSecs: 2,
    lockSecsFactor: 2,
    delaySecs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageLock", async () => {
    it("correct reports on missing message", async () => {
        const enqueued = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        }) as MessageEnqueueResultMessageEnqueued

        const enqueueResult = await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        expect(enqueueResult.resultType).toBe("MESSAGE_NOT_FOUND")

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        const releaseResult = await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        expect(releaseResult.resultType).toBe("MESSAGE_NOT_FOUND")

    })

    it("correctly locks messages", async () => {
        const enqueued = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        }) as MessageEnqueueResultMessageEnqueued

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        let channelState = await pool.query(sql`
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(testMessageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            current_size: 1,
            current_concurrency: 1
        })

        const dequeueResult = await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        channelState = await pool.query(sql`
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(testMessageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            current_size: 1,
            current_concurrency: 0
        })

        expect(dequeueResult.resultType).toBe("MESSAGE_LOCKED")

        const lockResult = await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueued.messageId,
        })

        expect(lockResult.resultType).toBe("MESSAGE_NOT_FOUND")

        const messageState = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(enqueued.messageId)}
        `).then(res => res.rows[0])

        expect(messageState).toMatchObject({
            status: MessageStatus.LOCKED,
            lock_secs: testMessageParams.lockSecs * testMessageParams.lockSecsFactor,
        })

        const job = await pool.query(sql`
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rows[0])

        const unlockParams = await pool.query(sql`
            SELECT * FROM test.job_message_unlock_params
            WHERE message_id = ${valueNode(enqueued.messageId)}
        `).then(res => res.rows[0])

        expect(job.process_after.getTime()).toEqual(
            messageState.locked_at.getTime() + testMessageParams.lockSecs * 1000
        )

        expect(unlockParams).toMatchObject({ message_id: enqueued.messageId })
    })
})


