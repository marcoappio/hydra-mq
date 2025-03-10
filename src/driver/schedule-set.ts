import { parseCronExpr } from '@src/core/cron'
import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'

export const scheduleSet = async (params: {
    cronExpr: string
    dbClient: DatabaseClient
    numAttempts: number
    payload: string
    priority: number | null
    queueId: string
    scheduleId: string
    schema: string
    staleSecs: number
    timeoutSecs: number
}) => {
    const parsedCronExpr = parseCronExpr(params.cronExpr)
    if (parsedCronExpr.resultType === 'CRON_EXPR_INVALID') {
        throw new Error(`Invalid cron expression: ${params.cronExpr}`)
    }

    await params.dbClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.schedule_set(
            ${sql.value(params.scheduleId)},
            ${sql.value(params.queueId)},
            ${sql.value(params.payload)},
            ${sql.value(params.priority)},
            ${sql.value(params.timeoutSecs)},
            ${sql.value(params.staleSecs)},
            ${sql.value(params.numAttempts)},
            ${sql.array(parsedCronExpr.mins)},
            ${sql.array(parsedCronExpr.hours)},
            ${sql.array(parsedCronExpr.days)},
            ${sql.array(parsedCronExpr.months)},
            ${sql.array(parsedCronExpr.daysOfWeek)}
        )
    `)

    return { resultType: 'SCHEDULE_SET' }
}
