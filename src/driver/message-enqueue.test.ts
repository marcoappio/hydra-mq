import { Deployment } from '@src/deployment'
import { beforeAll, expect, test } from 'bun:test'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const deployment = new Deployment({ schema: 'test' })

beforeAll(async () => {
    await pool.query('DROP SCHEMA IF EXISTS test CASCADE')
    await pool.query('CREATE SCHEMA test')
    for (const query of deployment.installation()) {
        await pool.query(query)
    }
})

test('messageEnqueue deduplication is working', async () => {

    let numRows: number
    const queueAlpha = deployment.queue('alpha')
    await queueAlpha.config.set({ databaseClient: pool, maxCapacity: null, maxConcurrency: 1 })
    const queueBeta = deployment.queue('beta')
    await queueBeta.config.set({ databaseClient: pool, maxCapacity: null, maxConcurrency: 1 })

    const firstAlphaMessage = await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'hello',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(1)
    expect(firstAlphaMessage.resultType).toBe('MESSAGE_ENQUEUED')

    const firstBetaMessage = await queueBeta.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'hello',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(2)
    expect(firstBetaMessage.resultType).toBe('MESSAGE_ENQUEUED')

    const secondAlphaMessage = await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'goodbye',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(3)
    expect(secondAlphaMessage.resultType).toBe('MESSAGE_ENQUEUED')

    const secondBetaMessage = await queueBeta.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'goodbye',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(4)
    expect(secondBetaMessage.resultType).toBe('MESSAGE_ENQUEUED')

    const thirdAlphaMessage = await queueAlpha.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'hello',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(4)
    expect(thirdAlphaMessage.resultType).toBe('MESSAGE_UPDATED')

    const thirdBetaMessage = await queueBeta.message.enqueue({
        databaseClient: pool,
        deduplicationId: 'hello',
        payload: 'hello',
    })

    numRows = await pool.query('SELECT COUNT(*)::INTEGER AS num_rows FROM test.message').then(res => res.rows[0]?.num_rows)
    expect(numRows).toBe(4)
    expect(thirdBetaMessage.resultType).toBe('MESSAGE_UPDATED')
})
