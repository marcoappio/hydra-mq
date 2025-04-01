import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { messageRelease } from "@src/schema/message-release/binding"
import { sql, valueNode } from "@src/core/sql"
import { channelPolicySet } from "@src/schema/channel-policy-set/binding"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/schema/message-dequeue/binding"

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
    delaySecs: 0,
    dependsOn: [],
}

describe("messageDequeue", async () => {

    it("correctly reports no messages available", async () => {
        const result = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })
        expect(result.resultType).toBe("QUEUE_EMPTY")
    })

    it("correctly dequeues messages with missing/unconstraints policy", async () => {
        const enqueued = [
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...messageParams
            }),
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...messageParams,
                priority: 1
            }),
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...messageParams,
                priority: 2
            }),
        ] as MessageEnqueueResultMessageEnqueued[]

        for(const messageResult of enqueued) {
            await messageRelease({
                databaseClient: pool,
                schema: "test",
                id: messageResult.messageId,
            })
        }

        let channelState = await pool.query(sql`
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState).toMatchObject({
            current_concurrency: 0,
            current_size: 3,
            next_message_id: enqueued[0].messageId,
            next_priority: null,
        })

        let firstResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })
        expect(firstResult.resultType).toBe("MESSAGE_DEQUEUED")
        firstResult = firstResult as MessageDequeueResultMessageDequeued

        expect(firstResult.message.id).toBe(enqueued[0].messageId)


        let secondResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })

        expect(secondResult.resultType).toBe("MESSAGE_DEQUEUED")
        secondResult = secondResult as MessageDequeueResultMessageDequeued

        expect(secondResult.message.id).toBe(enqueued[2].messageId)

        let thirdResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })

        expect(thirdResult.resultType).toBe("MESSAGE_DEQUEUED")
        thirdResult = thirdResult as MessageDequeueResultMessageDequeued

        expect(thirdResult.message.id).toBe(enqueued[1].messageId)

        channelState = await pool.query(sql`
            SELECT * FROM test.channel_state
            WHERE name = ${valueNode(messageParams.channelName)}
        `).then(res => res.rows[0])

        expect(channelState.next_message_id).toBe(null)

        const fourthResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })

        expect(fourthResult.resultType).toBe("QUEUE_EMPTY")
    })

    it("prevents further dequeues when concurrency constraints are not met", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: messageParams.channelName,
            maxConcurrency: 1,
            maxSize: null
        })

        const enqueued = [
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...messageParams
            }),
            await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...messageParams,
            }),
        ] as MessageEnqueueResultMessageEnqueued[]

        for(const messageResult of enqueued) {
            await messageRelease({
                databaseClient: pool,
                schema: "test",
                id: messageResult.messageId,
            })
        }

        let firstResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        })

        expect(firstResult.resultType).toBe("MESSAGE_DEQUEUED")
        firstResult = firstResult as MessageDequeueResultMessageDequeued

        expect(firstResult.message.id).toBe(enqueued[0].messageId)

        let secondResult = await messageDequeue({ 
            databaseClient: pool,
            schema: "test",
        }) 

        expect(secondResult.resultType).toBe("QUEUE_EMPTY")

    })

})



