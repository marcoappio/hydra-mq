import { parseCronExpr } from "@src/core/cron"
import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"

export type JobJobMessageCreateScheduleSetResult =
    | { resultType: "CRON_EXPR_INVALID" }
    | { resultType: "SCHEDULE_SET_MESSAGE_CREATE" }

export const jobJobMessageCreateScheduleSet = async (params: {
    name: string,
    cronExpr: string
    schema: string
    databaseClient: DatabaseClient
    message: {
        name: string | null
        channelName: string | null
        payload: string
        priority: number | null
        channelPriority: number | null
        numAttempts: number
        maxProcessingMs: number
        lockMs: number
        lockMsFactor: number
        delayMs: number
        deleteMs: number
    }
}) : Promise<JobJobMessageCreateScheduleSetResult> => {
    const parsedCronExpr = parseCronExpr(params.cronExpr)
    if (parsedCronExpr.resultType === "CRON_EXPR_INVALID") {
        return parsedCronExpr
    }

    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_job_message_create_schedule_set(
            ${valueNode(params.name)},
            ${valueNode(params.message.name)},
            ${valueNode(params.message.channelName)},
            ${valueNode(params.message.payload)},
            ${valueNode(params.message.priority)},
            ${valueNode(params.message.channelPriority)},
            ${valueNode(params.message.numAttempts)},
            ${valueNode(params.message.maxProcessingMs)},
            ${valueNode(params.message.lockMs)},
            ${valueNode(params.message.lockMsFactor)},
            ${valueNode(params.message.delayMs)},
            ${valueNode(params.message.deleteMs)},
            ${arrayNode(parsedCronExpr.expression.mins)},
            ${arrayNode(parsedCronExpr.expression.hours)},
            ${arrayNode(parsedCronExpr.expression.days)},
            ${arrayNode(parsedCronExpr.expression.months)},
            ${arrayNode(parsedCronExpr.expression.daysOfWeek)}
        )
    `)

    return { resultType: "SCHEDULE_SET_MESSAGE_CREATE" }
}
