import { parseCronExpr } from "@src/core/cron"
import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"

export type JobMessageEnqueueScheduleSetResult =
    | { resultType: "CRON_EXPR_INVALID" }
    | { resultType: "JOB_SCHEDULE_SET" }

export const jobMessageEnqueueScheduleSet = async (params: {
    name: string,
    cronExpr: string
    schema: string
    databaseClient: DatabaseClient
    message: {
        name: string | null
        channelName: string | null
        payload: string
        priority: number | null
        numAttempts: number
        maxProcessingSecs: number
        lockSecs: number
        lockSecsFactor: number
        delaySecs: number
    }
}) : Promise<JobMessageEnqueueScheduleSetResult> => {
    const parsedCronExpr = parseCronExpr(params.cronExpr)
    if (parsedCronExpr.resultType === "CRON_EXPR_INVALID") {
        return parsedCronExpr
    }

    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_message_enqueue_schedule_set(
            ${valueNode(params.name)},
            ${valueNode(params.message.name)},
            ${valueNode(params.message.channelName)},
            ${valueNode(params.message.payload)},
            ${valueNode(params.message.priority)},
            ${valueNode(params.message.numAttempts)},
            ${valueNode(params.message.maxProcessingSecs)},
            ${valueNode(params.message.lockSecs)},
            ${valueNode(params.message.lockSecsFactor)},
            ${valueNode(params.message.delaySecs)},
            ${arrayNode(parsedCronExpr.expression.mins)},
            ${arrayNode(parsedCronExpr.expression.hours)},
            ${arrayNode(parsedCronExpr.expression.days)},
            ${arrayNode(parsedCronExpr.expression.months)},
            ${arrayNode(parsedCronExpr.expression.daysOfWeek)}
        )
    `)

    return { resultType: "JOB_SCHEDULE_SET" }
}
