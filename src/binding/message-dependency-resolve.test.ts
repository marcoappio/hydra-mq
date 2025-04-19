import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { randomUUID } from "crypto"
import { messageDependencyResolve } from "@src/binding/message-dependency-resolve"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/binding/message-enqueue"
import { sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

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
    maxProcessingMs: 60,
    lockMs: 5,
    lockMsFactor: 2,
    delayMs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageDependencyResolve", async () => {

    it("correct reports missing message", async () => {
        const resolveResults = await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: randomUUID(),
            isSuccess: true,
        })
        expect(resolveResults.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("correctly modifies message state on fail", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const childEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [enqueueResult.messageId],
        }) as MessageEnqueueResultMessageEnqueued
        expect(childEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const resolveResults = await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: childEnqueueResult.messageId,
            isSuccess: false,
        })
        expect(resolveResults.resultType).toBe("MESSAGE_DEPENDENCY_RESOLVED")

        const message = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => res.rows[0])
        expect(message.num_dependencies).toBe(0)
        expect(message.num_dependencies_failed).toBe(1)

        const numJobRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numJobRows).toBe(1)
    })

    it("correctly modifies message state on success", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const childEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [enqueueResult.messageId],
        }) as MessageEnqueueResultMessageEnqueued
        expect(childEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const resolveResults = await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: childEnqueueResult.messageId,
            isSuccess: true,
        })
        expect(resolveResults.resultType).toBe("MESSAGE_DEPENDENCY_RESOLVED")

        const message = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => res.rows[0])
        expect(message.num_dependencies).toBe(0)
        expect(message.num_dependencies_failed).toBe(0)

        const numJobRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numJobRows).toBe(1)
    })

    it("doesn't release a message if dependencies are outstanding", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(enqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const otherEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        }) as MessageEnqueueResultMessageEnqueued
        expect(otherEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const childEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [enqueueResult.messageId, otherEnqueueResult.messageId],
        }) as MessageEnqueueResultMessageEnqueued
        expect(childEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const resolveResults = await messageDependencyResolve({
            databaseClient: pool,
            schema: "test",
            id: childEnqueueResult.messageId,
            isSuccess: true,
        })
        expect(resolveResults.resultType).toBe("MESSAGE_DEPENDENCY_RESOLVED")

        const message = await pool.query(sql`
            SELECT * FROM test.message
            WHERE id = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => res.rows[0])
        expect(message.num_dependencies).toBe(1)
        expect(message.num_dependencies_failed).toBe(0)

        const numJobRows = await pool.query(sql`
            SELECT COUNT(*) AS num_rows FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
            AND params->>'id' = ${valueNode(childEnqueueResult.messageId)}
        `).then(res => Number(res.rows[0].num_rows))
        expect(numJobRows).toBe(0)
    })

})
