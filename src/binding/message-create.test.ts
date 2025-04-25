import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { randomUUID } from "crypto"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
import { JobType } from "@src/schema/enum/job-type"
import { MessageStatus } from "@src/schema/enum/message-status"
import { messageRelease } from "@src/binding/message-release"
import { messageFail } from "@src/binding/message-fail"
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
    numAttempts: 1,
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    delayMs: 0,
    deleteMs: 321,
    dependsOn: []
}

describe("messageCreate", async () => {
    it("creates and releases the message", async () => {
        const result = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams
        })
        expect(result.resultType).toBe("MESSAGE_CREATED")

        const message = await pool.query(sql `
            SELECT * FROM test.message
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            id: result.id
        })

        const job = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
        `).then(res => res.rows[0])
        expect(job).toMatchObject({
            params: { id: result.id }
        })
    })

    it("adds missing deps but skips adding them to outstanding count", async () => {
        const result = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [randomUUID(), randomUUID(), randomUUID()],
        })
        expect(result.resultType).toBe("MESSAGE_CREATED")

        const message = await pool.query(sql `
            SELECT * FROM test.message
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            id: result.id
        })

        const job = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
        `).then(res => res.rows[0])
        expect(job).toMatchObject({
            params: { id: result.id }
        })

        const numDepRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.message_parent
            WHERE message_id = ${valueNode(result.id)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numDepRows).toBe(3)
    })

    it("creates but doesn't release the message if there are deps", async () => {
        const parentCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams
        })

        const result = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [parentCreateResult.id]
        })
        expect(result.resultType).toBe("MESSAGE_CREATED")

        const numRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(result.id)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numRows).toBe(0)

        const numDepRows = await pool.query(sql `
            SELECT COUNT(*) AS num_rows FROM test.message_parent
            WHERE message_id = ${valueNode(result.id)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numDepRows).toBe(1)
    })

    it("creates deps for already resolved messages and releases", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams
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

        await messageFail({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
            exhaust: true,
        })

        const childResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [createResult.id],
        })

        const dependencies = await pool.query(sql `
            SELECT * FROM test.message_parent
            WHERE message_id = ${valueNode(childResult.id)}
        `).then(res => res.rows)
        expect(dependencies).toHaveLength(1)
        expect(dependencies[0]).toMatchObject({
            parent_message_id: createResult.id,
            message_id: childResult.id,
            status: MessageStatus.EXHAUSTED
        })

        const releaseJob = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
        `).then(res => res.rows[0])
        expect(releaseJob).toMatchObject({
            params: { id: createResult.id },
        })
    })
})



