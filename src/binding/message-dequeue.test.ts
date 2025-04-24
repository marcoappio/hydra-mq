import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import { Pool } from "pg"
import { messageCreate } from "@src/binding/message-create"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/binding/message-dequeue"
import { messageRelease } from "@src/binding/message-release"
import { messageSuccess } from "@src/binding/message-success"
import { messageFail } from "@src/binding/message-fail"
import { messageDependencyUpdate } from "@src/binding/message-dependency-update"

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

describe("messageDequeue", async () => {

    it("correctly reports no messages available", async () => {
        const result = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })
        expect(result.resultType).toBe("QUEUE_EMPTY")
    })

    it("correctly returns dependencies", async () => {
        const completeCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        })

        const exhaustedCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
        })

        const missingId = randomUUID()
        const childCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            dependsOn: [completeCreateResult.id, exhaustedCreateResult.id, missingId]
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: completeCreateResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageSuccess({
            databaseClient: pool,
            schema: "test",
            id: completeCreateResult.id,
            result: "lol",
        })

        await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: childCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: exhaustedCreateResult.id,
        })

        await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })

        await messageFail({
            databaseClient: pool,
            schema: "test",
            id: exhaustedCreateResult.id,
            exhaust: true,
        })

        await messageDependencyUpdate({
            databaseClient: pool,
            schema: "test",
            id: childCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: childCreateResult.id,
        })

        const dequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(dequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(dequeueResult).toMatchObject({
            resultType: "MESSAGE_DEQUEUED",
            dependencies: expect.arrayContaining([
                expect.objectContaining({
                    id: completeCreateResult.id,
                    isSuccess: true,
                    dependencyType: "COMPLETED",
                    data: "lol"
                }),
                expect.objectContaining({
                    id: exhaustedCreateResult.id,
                    isSuccess: false,
                    dependencyType: "EXHAUSTED"
                }),
                expect.objectContaining({
                    id: missingId,
                    isSuccess: false,
                    dependencyType: "MISSING"
                })
            ])
        })
    })

    it("correctly dequeues messages in the correct order", async () => {
        const firstCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 2,
        })

        const secondCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 2
        })

        const thirdCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 1
        })

        const fourthCreateResult = await messageCreate({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            channelName: "other",
            priority: 1,
            channelPriority: 10
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: thirdCreateResult.id,
        })

        await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: fourthCreateResult.id,
        })

        const firstDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(firstDequeueResult.id).toBe(firstCreateResult.id)

        const secondDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(secondDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(secondDequeueResult.id).toBe(fourthCreateResult.id)

        const thirdDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(thirdDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(thirdDequeueResult.id).toBe(thirdCreateResult.id)

        const fourthDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(fourthDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(fourthDequeueResult.id).toBe(secondCreateResult.id)
    })

})



