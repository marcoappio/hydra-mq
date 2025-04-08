import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { messageEnqueue, type MessageEnqueueResultMessageEnqueued } from "@src/schema/message-enqueue/binding"
import { messageRelease, type MessageReleaseResultMessageReleased } from "@src/schema/message-release/binding"
import { channelPolicySet } from "@src/schema/channel-policy-set/binding"
import { messageDequeue, type MessageDequeueResultMessageDequeued } from "@src/schema/message-dequeue/binding"
import { messageDependencyResolve, type MessageDependencyResolveResultMessageDependencyResolved } from "@src/schema/message-dependency-resolve/binding"

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
    maxProcessingSecs: 60,
    lockSecs: 5,
    lockSecsFactor: 2,
    delaySecs: 0,
    dependsOn: [],
    dependencyFailureCascade: true,
}

describe("messageDequeue", async () => {

    it("correctly reports no messages available", async () => {
        const result = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        })
        expect(result.resultType).toBe("QUEUE_EMPTY")
    })

    it("correctly dequeues messages in the correct order", async () => {
        const firstEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 2,
        }) as MessageEnqueueResultMessageEnqueued
        expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const secondEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 2
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const thirdEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            priority: 1,
            channelPriority: 1
        }) as MessageEnqueueResultMessageEnqueued
        expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const fourthEnqueueResult = await messageEnqueue({
            databaseClient: pool,
            schema: "test",
            ...messageParams,
            channelName: "other",
            priority: 1,
            channelPriority: 10
        }) as MessageEnqueueResultMessageEnqueued
        expect(thirdEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

        const firstReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: firstEnqueueResult.messageId,
        }) as MessageReleaseResultMessageReleased
        expect(firstReleaseResult.resultType).toBe("MESSAGE_RELEASED")

        const secondReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: secondEnqueueResult.messageId,
        }) as MessageReleaseResultMessageReleased
        expect(secondReleaseResult.resultType).toBe("MESSAGE_RELEASED")

        const thirdReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: thirdEnqueueResult.messageId,
        }) as MessageReleaseResultMessageReleased
        expect(thirdReleaseResult.resultType).toBe("MESSAGE_RELEASED")

        const fourthReleaseResult = await messageRelease({
            databaseClient: pool,
            schema: "test",
            id: fourthEnqueueResult.messageId,
        }) as MessageReleaseResultMessageReleased
        expect(fourthReleaseResult.resultType).toBe("MESSAGE_RELEASED")

        const firstDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(firstDequeueResult.message.id).toBe(firstEnqueueResult.messageId)

        const secondDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(secondDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(secondDequeueResult.message.id).toBe(fourthEnqueueResult.messageId)

        const thirdDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(thirdDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(thirdDequeueResult.message.id).toBe(thirdEnqueueResult.messageId)

        const fourthDequeueResult = await messageDequeue({
            databaseClient: pool,
            schema: "test",
        }) as MessageDequeueResultMessageDequeued
        expect(fourthDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
        expect(fourthDequeueResult.message.id).toBe(secondEnqueueResult.messageId)
    })

    it("prevents further dequeues when concurrency constraints are not met", async () => {
        await channelPolicySet({
            databaseClient: pool,
            schema: "test",
            name: messageParams.channelName,
            maxConcurrency: 1,
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

        for (const messageResult of enqueued) {
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

    for (const dependencyFailureCascade of [true, false]) {
        it(`correctly reports on dependency status with dependencyFailureCascade:${dependencyFailureCascade}`, async () => {
            const firstEnqueueResult = await messageEnqueue({
                ...messageParams,
                databaseClient: pool,
                schema: "test",
                payload: "1",
            }) as MessageEnqueueResultMessageEnqueued

            expect(firstEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")
            const secondEnqueueResult = await messageEnqueue({
                ...messageParams,
                databaseClient: pool,
                schema: "test",
                payload: "2",
                dependsOn: [firstEnqueueResult.messageId],
                dependencyFailureCascade: dependencyFailureCascade
            }) as MessageEnqueueResultMessageEnqueued
            expect(secondEnqueueResult.resultType).toBe("MESSAGE_ENQUEUED")

            const firstReleaseResult = await messageRelease({
                databaseClient: pool,
                schema: "test",
                id: firstEnqueueResult.messageId,
            }) as MessageReleaseResultMessageReleased
            expect(firstReleaseResult.resultType).toBe("MESSAGE_RELEASED")

            const firstDequeueResult = await messageDequeue({
                databaseClient: pool,
                schema: "test",
            }) as MessageDequeueResultMessageDequeued
            expect(firstDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
            expect(firstDequeueResult.message.id).toBe(firstEnqueueResult.messageId)

            const firstResolveResult = await messageDependencyResolve({
                databaseClient: pool,
                schema: "test",
                id: secondEnqueueResult.messageId,
                isSuccess: false
            }) as MessageDependencyResolveResultMessageDependencyResolved
            expect(firstResolveResult.resultType).toBe("MESSAGE_DEPENDENCY_RESOLVED")

            const secondReleaseResult = await messageRelease({
                databaseClient: pool,
                schema: "test",
                id: secondEnqueueResult.messageId,
            }) as MessageReleaseResultMessageReleased
            expect(secondReleaseResult.resultType).toBe("MESSAGE_RELEASED")

            const secondDequeueResult = await messageDequeue({
                databaseClient: pool,
                schema: "test",
            }) as MessageDequeueResultMessageDequeued
            expect(secondDequeueResult.resultType).toBe("MESSAGE_DEQUEUED")
            expect(secondDequeueResult.message.id).toBe(secondEnqueueResult.messageId)
            expect(secondDequeueResult.message.isDependenciesMet).toBe(!dependencyFailureCascade)
        })
    }

})



