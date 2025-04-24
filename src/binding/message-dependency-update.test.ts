import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { randomUUID } from "crypto"
import { messageDependencyUpdate } from "@src/binding/message-dependency-update"
import { messageCreate } from "@src/binding/message-create"
import { sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"
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
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    delayMs: 0,
    deleteMs: 0,
    dependsOn: [],
}

describe("messageTargetDependencyUpdate", async () => {

    it("reports missing message", async () => {
        const resolveResults = await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: randomUUID(),
        })
        expect(resolveResults.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports message in invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })

        const resolveResults = await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(resolveResults.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("correctly modifies dependencies and releases messages", async () => {
        const parentCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        })

        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [parentCreateResult.id],
        })

        const messagePreUpdate = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(messagePreUpdate.num_dependencies).toBe(1)

        const updateResult = await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: createResult.id
        })
        expect(updateResult.resultType).toBe("MESSAGE_DEPENDENCY_UPDATED")

        const messagePostUpdate = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(messagePostUpdate.num_dependencies).toBe(0)

        const numJobRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(createResult.id)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numJobRows).toBe(1)
    })

    it("correctly modifies dependencies but doesn't release messages with outstanding dependencies", async () => {
        const parentCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        })

        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [parentCreateResult.id, parentCreateResult.id],
        })

        const messagePreUpdate = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(messagePreUpdate.num_dependencies).toBe(2)

        const updateResult = await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: createResult.id
        })
        expect(updateResult.resultType).toBe("MESSAGE_DEPENDENCY_UPDATED")

        const messagePostUpdate = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(messagePostUpdate.num_dependencies).toBe(1)

        const numJobRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(createResult.id)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numJobRows).toBe(0)
    })
})
