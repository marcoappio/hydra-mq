import { MESSAGE_NUM_ATTEMPTS, MESSAGE_PRIORITY, MESSAGE_STALE_SECS, MESSAGE_TIMEOUT_SECS } from '@src/core/config'
import type { DatabaseClient } from '@src/core/database-client'
import { scheduleClear } from '@src/driver/schedule-clear'
import { scheduleSet } from '@src/driver/schedule-set'

export class Schedule {
    private readonly schema: string
    private readonly queueId: string
    private readonly scheduleId: string

    constructor(params: {
        queueId: string
        scheduleId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
        this.scheduleId = params.scheduleId
    }

    async set(params: {
        cronExpr: string
        dbClient: DatabaseClient
        numAttempts?: number
        payload: string
        priority?: number
        staleSecs?: number
        timeoutSecs?: number
    }) {
        return scheduleSet({
            cronExpr: params.cronExpr,
            dbClient: params.dbClient,
            numAttempts: params.numAttempts ?? MESSAGE_NUM_ATTEMPTS,
            payload: params.payload,
            priority: params.priority ?? MESSAGE_PRIORITY,
            queueId: this.queueId,
            scheduleId: this.scheduleId,
            schema: this.schema,
            staleSecs: params.staleSecs ?? MESSAGE_STALE_SECS,
            timeoutSecs: params.timeoutSecs ?? MESSAGE_TIMEOUT_SECS,
        })
    }

    async clear(params: {
        dbClient: DatabaseClient
    }) {
        return scheduleClear({
            dbClient: params.dbClient,
            queueId: this.queueId,
            scheduleId: this.scheduleId,
            schema: this.schema,
        })
    }

}
