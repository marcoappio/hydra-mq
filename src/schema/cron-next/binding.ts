import type { CronExpr } from "@src/core/cron"
import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"
import { CronNextResultCode } from "@src/schema/cron-next/install"

type QueryResultTimestampFound = {
    o_result_code: CronNextResultCode.TIMESTAMP_FOUND
    o_timestamp: Date
}

type QueryResultTimestampNotFound = {
    o_result_code: CronNextResultCode.TIMESTAMP_NOT_FOUND,
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
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === CronNextResultCode.TIMESTAMP_FOUND) {
        return {
            resultType: "TIMESTAMP_FOUND",
            timestamp: result.o_timestamp,
        }
    } else if (result.o_result_code === CronNextResultCode.TIMESTAMP_NOT_FOUND) {
        return {
            resultType: "TIMESTAMP_NOT_FOUND"
        }
    } else {
        throw new Error("Unexpected result")
    }
}
