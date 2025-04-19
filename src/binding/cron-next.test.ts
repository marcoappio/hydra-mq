import { Queue } from "@src/queue"
import { beforeEach, describe, expect, it } from "bun:test"
import { Pool } from "pg"
import { parseCronExpr, type CronExpr } from "@src/core/cron"
import { cronNext, type CronNextResult } from "@src/binding/cron-next"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const queue = new Queue({ schema: "test" })

type TestSet = {
    expression: [string, CronExpr]
    testPairs: [Date, CronNextResult][],
}

const getCron = (expr: string): [string, CronExpr] => {
    const parsed = parseCronExpr(expr)
    if (parsed.resultType === "CRON_EXPR_INVALID") {
        throw new Error(`Invalid cron expression: ${expr}`)
    }
    return [expr, parsed.expression]
}

beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS test CASCADE")
    await pool.query("CREATE SCHEMA test")
    for (const query of queue.installation()) {
        await pool.query(query)
    }
})

const testSets : TestSet[] = [
    {
        expression: getCron("* * * * *"),
        testPairs: [
            [
                new Date("2023-01-01T00:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T00:01:00Z") }
            ],
            [
                new Date("2023-01-01T00:01:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T00:02:00Z") }
            ],
            [
                new Date("2023-01-01T00:00:30Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T00:01:00Z") }
            ],
            [
                new Date("2023-01-01T00:59:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T01:00:00Z") }
            ],
            [
                new Date("2023-01-31T23:59:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-02-01T00:00:00Z") }
            ],
        ]
    },
    {
        expression: getCron("*/5 * * * *"),
        testPairs: [
            [
                new Date("2023-01-01T00:02:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T00:05:00Z") }
            ],
            [
                new Date("2023-01-01T00:04:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T00:05:00Z") }
            ],
        ]
    },
    {
        expression: getCron("0 * * * *"),
        testPairs: [
            [
                new Date("2023-01-01T00:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T01:00:00Z") }
            ],
            [
                new Date("2023-01-01T01:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T02:00:00Z") }
            ],
            [
                new Date("2023-01-01T00:30:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-01T01:00:00Z") }
            ],
            [
                new Date("2023-01-01T23:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-01-02T00:00:00Z") }
            ],
            [
                new Date("2023-01-31T23:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2023-02-01T00:00:00Z") }
            ],
        ],
    },
    {
        expression: getCron("* * 31 2 *"),
        testPairs: [
            [
                new Date("2023-01-01T00:00:00Z"),
                { resultType: "TIMESTAMP_NOT_FOUND" }
            ]
        ],
    },
    {
        expression: getCron("0 0 * * 0"),
        testPairs: [
            [
                new Date("2025-04-03T00:00:00Z"),
                { resultType: "TIMESTAMP_FOUND", timestamp: new Date("2025-04-06T00:00:00Z") }
            ],
        ],
    },
]

describe("cron_next", async () => {

    for (const testSet of testSets) {
        const [rawExpr, parsedExpr] = testSet.expression
        for (const [start, next] of testSet.testPairs) {
            const startStr = start.toISOString()
            it(`using: ${rawExpr}, we should correctly iterate from: ${startStr}`, async () => {
                const result = await cronNext({
                    databaseClient: pool,
                    cronExpr: parsedExpr,
                    schema: "test",
                    timestamp: start,
                })
                expect(result).toEqual(next)
            })
        }


    }
})
