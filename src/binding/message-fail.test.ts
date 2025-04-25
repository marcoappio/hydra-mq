import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { messageFail } from "@src/binding/message-fail"
import { messageRelease } from "@src/binding/message-release"
import { messageDequeue }  from "@src/binding/message-dequeue"
import { MessageStatus } from "@src/schema/enum/message-status"
import { JobType } from "@src/schema/enum/job-type"
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
    numAttempts: 1,
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    delayMs: 0,
    deleteMs: 0,
    dependsOn: [],
}

describe("messageFail", async () => {
    it("reports when message not found", async () => {
        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: randomUUID(),
            exhaust: false
        })
        expect(failResult.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports message with invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams
        })

        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            exhaust: false
        })
        expect(failResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly locks messages when attempts are remaining", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 2,
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

        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            exhaust: false
        })
        expect(failResult.resultType).toBe("MESSAGE_LOCKED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: testMessageParams.channelName,
            current_size: 1,
            current_concurrency: 0,
        })

        const status = await pool.query(sql `
            SELECT status FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0].status)
        expect(status).toBe(MessageStatus.LOCKED)

        const lockParams = await pool.query(sql `
            SELECT params FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_UNLOCK)}
        `).then(res => res.rows[0].params)
        expect(lockParams).toMatchObject({ id: createResult.id })
    })

    it("correctly exhausts messages when exhaust is forced", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 10,
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

        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            exhaust: true
        })
        expect(failResult.resultType).toBe("MESSAGE_EXHAUSTED")

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
            status: MessageStatus.EXHAUSTED
        })

        const deleteJob = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_DELETE)}
        `).then(res => res.rows[0])
        expect(deleteJob).toMatchObject({
            params: { id: createResult.id },
        })
    })

    it("correctly exhausts messages when no attempts are remaining", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...testMessageParams,
            numAttempts: 1
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

        const failResult = await messageFail({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            exhaust: true
        })
        expect(failResult.resultType).toBe("MESSAGE_EXHAUSTED")

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
            status: MessageStatus.EXHAUSTED
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
            status: MessageStatus.EXHAUSTED,
        })
    })
})


