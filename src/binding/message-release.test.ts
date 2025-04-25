import { Queue } from "@src/queue"
import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/binding/message-release"
import { messageCreate } from "@src/binding/message-create"
import { sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"
import { channelPolicySet } from "@src/binding/channel-policy-set"
import { messageDequeue } from "@src/binding/message-dequeue"
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
    numAttempts: 1,
    maxProcessingMs: 60_000,
    lockMs: 0,
    lockMsFactor: 2,
    delayMs: 0,
    deleteMs: 0,
    dependsOn: []
}

describe("messageRelease", async () => {

    it("correctly reports on missing message", async () => {
        const result = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: randomUUID()
        })
        expect(result.resultType).toBe("MESSAGE_NOT_FOUND")
    })

    it("reports when message has invalid status", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_STATUS_INVALID")
    })

    it("drops a message when at capacity", async () => {
        await channelPolicySet({
            name: messageParams.channelName,
            databaseClient: pool,
            schema: "test",
            maxConcurrency: null,
            maxSize: 0
        })

        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [createResult.id],
        })

        const releaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(releaseResult.resultType).toBe("MESSAGE_DROPPED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            current_size: 0,
            current_concurrency: 0,
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.DROPPED
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
            status: MessageStatus.DROPPED,
        })

    })

    it("doesn't dedupe a message when already processed", async () => {
        const firstCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        })

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstCreateResult.id,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            current_size: 2,
            current_concurrency: 1,
        })
    })

    it("dedupes a message when appropriate", async () => {
        const firstCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            name: "foo",
        })

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstCreateResult.id,
        })
        expect(firstReleaseResult.resultType).toBe("MESSAGE_ACCEPTED")

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })
        expect(secondReleaseResult.resultType).toBe("MESSAGE_DEDUPLICATED")

        await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [secondCreateResult.id],
        })

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            current_size: 1,
            current_concurrency: 0,
        })

        const message = await pool.query(sql `
            SELECT * FROM test.message
            WHERE id = ${valueNode(secondCreateResult.id)}
        `).then(res => res.rows[0])
        expect(message).toMatchObject({
            status: MessageStatus.DEDUPLICATED
        })

        const deleteJob = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_DELETE)}
        `).then(res => res.rows[0])
        expect(deleteJob).toMatchObject({
            params: { id: secondCreateResult.id },
        })

        const dependency = await pool.query(sql `
            SELECT * FROM test.message_parent
            WHERE parent_message_id = ${valueNode(secondCreateResult.id)}
        `).then(res => res.rows[0])
        expect(dependency).toMatchObject({
            message_id: expect.any(String),
            status: MessageStatus.DEDUPLICATED,
        })
    })

    it("correctly accepts messages and sets up channel state", async () => {
        const createResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        })

        const result = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: createResult.id,
        })
        expect(result.resultType).toBe("MESSAGE_ACCEPTED")

        let channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        const message = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(createResult.id)}
        `).then(res => res.rows[0])

        expect(message).toMatchObject({
            status: MessageStatus.ACCEPTED,
        })

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_concurrency: null,
            max_size: null,
            current_size: 1,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            priority: 100
        })

        const secondResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })
        expect(secondResult.resultType).toBe("MESSAGE_ACCEPTED")

        channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_concurrency: null,
            max_size: null,
            current_size: 2,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })
    })
})


