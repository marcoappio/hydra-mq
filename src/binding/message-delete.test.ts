import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue }  from "@src/binding/message-dequeue"
import { randomUUID } from "crypto"
import { messageDelete } from "@src/binding/message-delete"
import { messageSuccess } from "@src/binding/message-success"

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
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    delayMs: 0,
    deleteMs: 0,
    dependsOn: [],
}

describe("messageDelete", async () => {
    it("reports when message not found", async () => {
        const failResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(failResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports message with invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        })

        const deleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(deleteResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly deletes a message", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            dependsOn: [randomUUID()]
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

        await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            result: null,
        })

        const deleteResult = await messageDelete({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(deleteResult.resultType).toBe("MESSAGE_DELETED")

        const message = await pool.query(sql`
            SELECT * FROM test.message WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toBeUndefined()

        const channelState = await pool.query(sql`
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toBeUndefined()

        const messageParent = await pool.query(sql`
            SELECT * FROM test.message_parent WHERE message_id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(messageParent).toBeUndefined()
    })

})



