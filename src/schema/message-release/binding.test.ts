import { Queue } from "@src/queue"
import { randomUUID } from "crypto"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageRelease } from "@src/schema/message-release/binding"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { sql, valueNode } from "@src/core/sql"
import { channelPolicySet } from "@src/schema/channel-policy-set/binding"
import { JobType } from "@src/schema/job"
import { MessageStatus } from "@src/schema/message"

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
    name: null,
    numAttempts: 1,
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    delaySecs: 30,
    dependsOn: [],
    dependencyFailureCascade: true,
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

    it("correctly releases messages with a missing/unconstrained policy", async () => {
        const enqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
        }) as MessageEnqueueResultMessageEnqueued

        const job = await pool.query(sql `
            SELECT * FROM test.job
            WHERE type = ${valueNode(JobType.MESSAGE_RELEASE)}
        `).then(res => res.rows[0])

        const result = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResult.messageId,
        })

        expect(result.resultType).toBe("MESSAGE_RELEASED")
        let channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        const message = await pool.query(sql `
            SELECT * FROM test.message    
            WHERE id = ${valueNode(enqueueResult.messageId)}
        `).then(res => res.rows[0])

        expect(message).toMatchObject({
            status: MessageStatus.WAITING,
        })

        expect(job.process_after.getTime()).toEqual(message.created_at.getTime() + messageParams.delaySecs * 1000)

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_size: null,
            max_concurrency: null,
            current_size: 1,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ... messageParams,
            priority: 100
        }) as MessageEnqueueResultMessageEnqueued

        const secondResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        })

        expect(secondResult.resultType).toBe("MESSAGE_RELEASED")

        channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])
        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_size: null,
            max_concurrency: null,
            current_size: 2,
            current_concurrency: 0,
            next_message_id: message.id,
            next_priority: null
        })
    })

    it("correctly drops messages with a missing/unconstrained policy", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: messageParams.channelName,
            maxConcurrency: null,
            maxSize: 1
        })

        const enqueueResults = [
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ... messageParams,
            }),

            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ... messageParams,
            }),
        ] as MessageEnqueueResultMessageEnqueued[]

        const firstResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResults[0].messageId,
        })

        const secondResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: enqueueResults[1].messageId,
        })

        expect(firstResult.resultType).toBe("MESSAGE_RELEASED")
        expect(secondResult.resultType).toBe("MESSAGE_DROPPED")

        const params = await pool.query(sql `
            SELECT * FROM test.job_message_delete_params
        `).then(res => res.rows[0])

        expect(params).toMatchObject({
            message_id: enqueueResults[1].messageId,
        })

        const channelState = await pool.query(sql `
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            name: messageParams.channelName,
            max_size: 1,
            max_concurrency: null,
            current_size: 1,
            current_concurrency: 0,
            next_message_id: enqueueResults[0].messageId,
            next_priority: null
        })

    })
})


