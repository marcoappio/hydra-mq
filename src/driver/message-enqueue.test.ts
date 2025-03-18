import { Deployment } from "@src/deployment"
import { MessageStatus } from "@src/driver/message-status"
import { beforeEach, expect, test } from "bun:test"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const deployment = new Deployment({ schema: "test" })

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of deployment.installation()) {
        await pool.query(query)
    }
})

test("messageEnqueue", async () => {
    const queueAlpha = deployment.queue("alpha")
    await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        numAttempts: 42,
        payload: "hello",
        priority: 42,
        staleSecs: 42,
        timeoutSecs: 42,
    })

    const messageRow = await pool.query("SELECT * FROM test.message").then(res => res.rows[0])
    expect(messageRow).toMatchObject({
        id: expect.any(String),
        num_attempts: 42,
        payload: "hello",
        priority: 42,
        queue_id: "alpha",
        stale_secs: 42,
        status: MessageStatus.READY,
        timeout_secs: 42,
    })

})

test("messageEnqueue max queue capacity", async () => {
    const queueAlpha = deployment.queue("alpha")
    await queueAlpha.config.set({ databaseClient: pool, maxCapacity: 1, maxConcurrency: 1 })

    await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        payload: "hello",
    })

    const result = await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        payload: "hello",
    })

    expect(result.resultType).toBe("QUEUE_CAPACITY_EXCEEDED")
})

test("messageEnqueue deduplication", async () => {
    let numRows: number
    const queueAlpha = deployment.queue("alpha")
    await queueAlpha.config.set({ databaseClient: pool, maxCapacity: null, maxConcurrency: 1 })
    const queueBeta = deployment.queue("beta")
    await queueBeta.config.set({ databaseClient: pool, maxCapacity: null, maxConcurrency: 1 })

    await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        payload: "hello",
    })

    const firstBetaMessage = await queueBeta.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        payload: "hello",
    })

    numRows = await pool.query("SELECT COUNT(*)::INTEGER AS num_rows FROM test.message").then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(2)
    expect(firstBetaMessage.resultType).toBe("MESSAGE_ENQUEUED")

    const secondAlphaMessage = await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: "hello",
        payload: "goodbye",
    })

    numRows = await pool.query("SELECT COUNT(*)::INTEGER AS num_rows FROM test.message").then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(2)
    expect(secondAlphaMessage.resultType).toBe("MESSAGE_UPDATED")
})
