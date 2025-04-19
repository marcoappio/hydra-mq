import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/binding/message-dequeue"
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

describe("messageDequeue", async () => {

    it("correctly reports no messages available", async () => {
        const result = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })
        expect(result.resultType).toBe("QUEUE_EMPTY")
    })

    it("correctly dequeues messages in the correct order", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 2,
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 2
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const thirdEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 1
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const fourthEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            channelName: "other",
            priority: 1,
            channelPriority: 10
        }) as MessageEnqueueResultMessageEnqueued
        expect(thirdEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

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

        const thirdReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: thirdEnqueueResult.messageId,
        })
        expect(thirdReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const fourthReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: fourthEnqueueResult.messageId,
        })
        expect(fourthReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const firstDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(firstDequeueResult.message.id).toBe(firstEnqueueResult.messageId)

        const secondDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(secondDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(secondDequeueResult.message.id).toBe(fourthEnqueueResult.messageId)

        const thirdDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(thirdDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(thirdDequeueResult.message.id).toBe(thirdEnqueueResult.messageId)

        const fourthDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(fourthDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(fourthDequeueResult.message.id).toBe(secondEnqueueResult.messageId)
    })

})



