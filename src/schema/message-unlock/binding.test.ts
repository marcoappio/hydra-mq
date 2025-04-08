import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/schema/message-release/binding"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { sql, valueNode } from "@src/core/sql"
import { messageUnlock } from "@src/schema/message-unlock/binding"
import { messageLock } from "@src/schema/message-lock/binding"
import { MessageStatus } from "@src/schema/message"
import { messageDequeue } from "@src/schema/message-dequeue/binding"

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
    name: null,
    numAttempts: 1,
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    delaySecs: 30,
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

        const releaseResult = await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        expect(releaseResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("correctly unlocks messages", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        const earlyMessage = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0])

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageLock({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        const result = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId
        })

        expect(result).toMatchObject({
            resultType: "MESSAGE_UNLOCKED",
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0])

        expect(message).toMatchObject({
            status: MessageStatus.WAITING
        })

        expect(message.waiting_at.getTime()).toBeGreaterThan(earlyMessage.waiting_at.getTime())

    })
})



