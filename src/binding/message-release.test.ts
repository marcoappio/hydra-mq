import { Queue } from "@src/queue"
import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/binding/message-release"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"
import { MessageStatus } from "@src/schema/message"
import { channelPolicySet } from "@src/binding/channel-policy-set"
import { messageDependencyResolve } from "@src/binding/message-dependency-resolve"

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

describe("messageRelease", async () => {

    it("correctly reports on missing message", async () => {
        const result = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(result.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("sets message to unsatisfied when deps are not met", async () => {
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
            dependsOn: [firstEnqueueResult.messageId]
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
            isSuccess: false
        })

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_UNSATISFIED")

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(secondEnqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.UNSATISFIED)

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 0,
            current_concurrency: 0,
        })

        const finalizeParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rows[0].params)
        expect(finalizeParams).toMatchObject({ id: secondEnqueueResult.messageId })
    })

    it("doesnt set a message to unsatisfied when deps are not met but cascade is false", async () => {
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
            dependsOn: [firstEnqueueResult.messageId],
            dependencyFailureCascade: false
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
            isSuccess: false
        })

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")
    })

    it("drops a message when at capacity", async () => {
        await channelPolicySet({
            name: messageParams.channelName,
            databaseClient: pool,
            schema: "test",
            maxConcurrency: null,
            maxSize: 0
        })

        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(releaseResult.resultType).toBe("MESSAGE_DROPPED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 0,
            current_concurrency: 0,
        })

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.DROPPED)

        const finalizeParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rows[0].params)
        expect(finalizeParams).toMatchObject({ id: enqueueResult.messageId })
    })

    it("doesn't dedupe a message when already processed", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        await pool.query(sql `
            UPDATE test.message
            SET is_processed = TRUE
            WHERE id = ${valueNode(firstEnqueueResult.messageId)}
        `)

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 2,
            current_concurrency: 0,
        })
    })

    it("dedupes a message when appropriate", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
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
        expect(secondReleaseResult.resultType).toBe("MESSAGE_DEDUPLICATED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 1,
            current_concurrency: 0,
        })

        const secondStatus = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(secondEnqueueResult.messageId)}
        `).then(res => res.rows[0].status)
        expect(secondStatus).toBe(MessageStatus.DEDUPLICATED)

        const finalizeParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_FINALIZE)}
        `).then(res => res.rows[0].params)
        expect(finalizeParams).toMatchObject({ id: secondEnqueueResult.messageId })
    })

    it("correctly releases messages and sets up channel state", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const job = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
        `).then(res => res.rows[0])

        const result = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })
        expect(result.resultType).toBe("MESSAGE_ACCEPTED")

        let channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        const message = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0])

        expect(message).toMatchObject({
            status: MessageStatus.ACCEPTED,
        })

        expect(job.process_after.getTime()).toEqual(message.created_at.getTime() + messageParams.delayMs)

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_concurrency: null,
            current_size: 1,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            priority: 100
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })
        expect(secondResult.resultType).toBe("MESSAGE_ACCEPTED")

        channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_concurrency: null,
            current_size: 2,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })
    })
})


