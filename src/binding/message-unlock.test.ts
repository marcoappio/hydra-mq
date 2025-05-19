import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/binding/message-release"
import { messageCreate } from "@src/binding/message-create"
import { sql, valueNode } from "@src/core/sql"
import { messageUnlock } from "@src/binding/message-unlock"
import { messageDequeue } from "@src/binding/message-dequeue"
import { randomUUID } from "crypto"
import { messageRetry } from "@src/binding/message-retry"

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
    maxProcessingMs: 60_000,
    delayMs: 0
}

describe("messageUnlock", async () => {
    it("reports message not found", async () => {
        const unlockResult = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(unlockResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports message in an invalid state", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        const unlockResult = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: createResult.id
        })
        expect(unlockResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly unlocks messages and sets next channel message if available", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageRetry({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            lockMs: 1
        })

        const unlockResult = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: createResult.id
        })
        expect(unlockResult.resultType).toBe("MESSAGE_ACCEPTED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(result => result.rows[0])
        expect(channelState.next_message_id).toEqual(createResult.id)
    })

    it("correctly unlocks messages but doesn't set next channel message if not available", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })

        await messageRetry({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            lockMs: 1
        })

        const unlockResult = await messageUnlock({
            databaseClient: pool,
            schema: "test",
            id: createResult.id
        })
        expect(unlockResult.resultType).toBe("MESSAGE_ACCEPTED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(result => result.rows[0])
        expect(channelState.next_message_id).toEqual(secondCreateResult.id)
    })
})



