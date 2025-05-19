import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageCreate } from "@src/binding/message-create"
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

const messageParams = {
    channelName: "test-channel",
    payload: "test-payload",
    priority: null,
    channelPriority: null,
    name: null,
    maxProcessingMs: 60_000,
    delayMs: 0,
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
})



