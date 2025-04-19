import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/binding/message-release"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { sql, valueNode } from "@src/core/sql"
import { messageUnlock } from "@src/binding/message-unlock"
import { messageFail } from "@src/binding/message-fail"
import { MessageStatus } from "@src/schema/message"
import { messageDequeue } from "@src/binding/message-dequeue"

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
    numAttempts: 10,
    maxProcessingMs: 60,
    lockMs: 5,
    lockMsFactor: 2,
    delayMs: 30,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageUnlock", async () => {

    it("correctly reports on missing message", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued

        const result = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId
        })
        expect(result.resultType).toBe("MESSAGE_NOT_FOUND")

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        const releaseResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
            exhaust: false
        })

        expect(releaseResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("correctly unlocks messages", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
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
            exhaust: false
        })
        expect(failResult.resultType).toBe("MESSAGE_LOCKED")

        const unlockResult = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId
        })
        expect(unlockResult.resultType).toBe("MESSAGE_ACCEPTED")

        const message = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0])

        expect(message).toMatchObject({
            status: MessageStatus.ACCEPTED
        })

    })
})



