import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue } from "@src/binding/message-dequeue"
import { messageDelete } from "@src/binding/message-delete"
import { randomUUID } from "crypto"

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
    maxProcessingMs: 60_000,
    delayMs: 0
}

describe("messageDelete", async () => {
    it("reports on message not found", async () => {
        const deleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(deleteResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports on message with an invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        const deleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(deleteResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly deletes messages", async () => {
        const firstCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const firstDeleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: firstCreateResult.id,
        })

        expect(firstDeleteResult.resultType).toBe("MESSAGE_DELETED")

        const firstChannelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(firstChannelState).toMatchObject({
            name: testMessageParams.channelName,
            current_size: 1,
            current_concurrency: 0,
        })

        const firstMessage = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(firstCreateResult.id)}
        `).then(res => res.rows[0])
        expect(firstMessage).toBeUndefined()

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const secondDeleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })

        expect(secondDeleteResult.resultType).toBe("MESSAGE_DELETED")

        const secondChannelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(secondChannelState).toBeUndefined()

        const secondMessage = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(secondCreateResult.id)}
        `).then(res => res.rows[0])
        expect(secondMessage).toBeUndefined()
    })
})


