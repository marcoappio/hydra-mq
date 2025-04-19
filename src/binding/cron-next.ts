import type { CronExpr } from "@src/core/cron"
import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"

type QueryResultTimestampFound = {
    o_timestamp: Date
}

type QueryResultTimestampNotFound = {
    o_timestamp: null
}

type QueryResult =
    | QueryResultTimestampFound
    | QueryResultTimestampNotFound

type DriverResultTimestampFound = {
    resultType: "TIMESTAMP_FOUND"
    timestamp: Date
}

type DriverResultTimestampNotFound = {
    resultType: "TIMESTAMP_NOT_FOUND"
}

export type CronNextResult =
    | DriverResultTimestampFound
    | DriverResultTimestampNotFound

export const cronNext = async (params: {
    databaseClient: DatabaseClient,
    schema: string,
    cronExpr: CronExpr,
    timestamp: Date
}) : Promise<CronNextResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.cron_next(
            ${arrayNode(params.cronExpr.mins)},
            ${arrayNode(params.cronExpr.hours)},
            ${arrayNode(params.cronExpr.days)},
            ${arrayNode(params.cronExpr.months)},
            ${arrayNode(params.cronExpr.daysOfWeek)},
            ${valueNode(params.timestamp)}
        ) AS o_timestamp
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_timestamp !== null) {
        return {
            resultType: "TIMESTAMP_FOUND",
            timestamp: result.o_timestamp,
        }
    } else {
        return {
            resultType: "TIMESTAMP_NOT_FOUND"
        }
    }
}
