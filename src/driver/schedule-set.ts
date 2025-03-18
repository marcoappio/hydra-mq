import { parseCronExpr } from "@src/core/cron"
import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"

export const scheduleSet = async (params: {
    cronExpr: string
    databaseClient: DatabaseClient
    deduplicationId: string | null
    numAttempts: number
    payload: string
    priority: number | null
    groupId: string
    queueId: string
    scheduleId: string
    schema: string
    staleSecs: number
    timeoutSecs: number
}) => {
    const parsedCronExpr = parseCronExpr(params.cronExpr)
    if (parsedCronExpr.resultType === "CRON_EXPR_INVALID") {
        throw new Error(`Invalid cron expression: ${params.cronExpr}`)
    }

    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.schedule_set(
            ${valueNode(params.groupId)},
            ${valueNode(params.queueId)},
            ${valueNode(params.scheduleId)},
            ${valueNode(params.payload)},
            ${valueNode(params.priority)},
            ${valueNode(params.timeoutSecs)},
            ${valueNode(params.staleSecs)},
            ${valueNode(params.numAttempts)},
            ${valueNode(params.deduplicationId)},
            ${arrayNode(parsedCronExpr.mins)},
            ${arrayNode(parsedCronExpr.hours)},
            ${arrayNode(parsedCronExpr.days)},
            ${arrayNode(parsedCronExpr.months)},
            ${arrayNode(parsedCronExpr.daysOfWeek)}
        )
    `)

    return { resultType: "SCHEDULE_SET" }
}
