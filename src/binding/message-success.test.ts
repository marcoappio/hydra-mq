import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue } from "@src/binding/message-dequeue"
import { messageSuccess } from "@src/binding/message-success"
import { randomUUID } from "crypto"
import { MessageStatus } from "@src/schema/enum/message-status"
import { JobType } from "@src/schema/enum/job-type"

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

describe("messageSuccess", async () => {
    it("reports on message not found", async () => {
        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            result: null,
            id: randomUUID()
        })
        expect(successResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports on message with an invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            result: null,
        })
        expect(successResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly completes messages", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
        })

        await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            dependsOn: [createResult.id],
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

        const successResult = await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            result: "test2"
        })

        expect(successResult.resultType).toBe("MESSAGE_SUCCEEDED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: testMessageParams.channelName,
            current_size: 0,
            current_concurrency: 0,
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.COMPLETED
        })

        const deleteJob = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_DELETE)}
        `).then(res => res.rows[0])
        expect(deleteJob).toMatchObject({
            params: { id: createResult.id },
        })

        const dependency = await pool.query(sql `
            SELECT * FROM test.message_parent
            WHERE parent_message_id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(dependency).toMatchObject({
            message_id: expect.any(String),
            status: MessageStatus.COMPLETED,
            result: "test2",
        })
    })
})


