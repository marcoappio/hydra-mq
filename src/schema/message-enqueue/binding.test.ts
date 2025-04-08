import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { sql, valueNode } from "@src/core/sql"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { MessageStatus } from "@src/schema/message"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

type TestParams = {
    description: string
    channelName: string
    payload: string
    priority: number | null
    name: string | null
    numAttempts: number
    maxProcessingSecs: number
    lockSecs: number
    lockSecsFactor: number
    delaySecs: number
    dependsOn: string[],
    dependencyFailureCascade: boolean,
}

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

const nulledFieldsTestParams = {
    description: "nulled fields",
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
    dependencyFailureCascade: true,
}

const filledFieldsTestParams = {
    description: "filled fields",
    channelName: "test-channel",
    payload: "test-payload",
    priority: 5,
    name: "test-key",
    numAttempts: 1,
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    delaySecs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

const enqueueTestSet : TestParams[]  = [
    nulledFieldsTestParams,
    filledFieldsTestParams,
]

describe("queueMessageEnqueue", async () => {
    for (const testParams of enqueueTestSet) {
        it(`correctly enqueues message: ${testParams.description}`, async () => {
            const result = await messageEnqueue({
                databaseClient: pool,
                schema: "test",
                ...testParams
            }) as MessageEnqueueResultMessageEnqueued

            expect(result.resultType).toBe("MESSAGE_ENQUEUED")

            const enqueuedMessages = await pool.query(sql `
                SELECT * FROM test.message
            `)

            expect(enqueuedMessages.rowCount).toBe(1)
            expect(enqueuedMessages.rows[0]).toMatchObject({
                channel_name: testParams.channelName,
                payload: testParams.payload,
                priority: testParams.priority,
                num_attempts: testParams.numAttempts,
                max_processing_secs: testParams.maxProcessingSecs,
                lock_secs: testParams.lockSecs,
                lock_secs_factor: testParams.lockSecsFactor,
                is_processed: false,
                waiting_at: null,
                name: testParams.name,
                status: MessageStatus.CREATED,
                id: result.messageId,
            })

            const enqueuedParams = await pool.query(sql `
                SELECT * FROM test.job_message_release_params
            `)

            expect(enqueuedParams.rowCount).toBe(1)
            expect(enqueuedParams.rows[0]).toMatchObject({
                message_id: enqueuedMessages.rows[0].id,
            })
        })
    }

    it("correctly deduplicates messages", async () => {
        const firstResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...filledFieldsTestParams
        }) as MessageEnqueueResultMessageEnqueued

        const secondResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...filledFieldsTestParams
        })

        await pool.query(sql `
            UPDATE test.message
            SET is_processed = true
            WHERE id = ${valueNode(firstResult.messageId)}
        `)

        const thirdResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...filledFieldsTestParams
        }) as MessageEnqueueResultMessageEnqueued

        expect(firstResult.resultType).toBe("MESSAGE_ENQUEUED")
        expect(secondResult.resultType).toBe("MESSAGE_DEDUPLICATED")
        expect(thirdResult.resultType).toBe("MESSAGE_ENQUEUED")
        expect(firstResult.messageId).not.toBe(thirdResult.messageId)


    })
})

