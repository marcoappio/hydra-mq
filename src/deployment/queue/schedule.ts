import { MESSAGE_NUM_ATTEMPTS, MESSAGE_PRIORITY, MESSAGE_STALE_SECS, MESSAGE_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { scheduleClear } from "@src/driver/schedule-clear"
import { scheduleSet } from "@src/driver/schedule-set"

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
        databaseClient: DatabaseClient
        deduplicationId?: string
        numAttempts?: number
        payload: string
        priority?: number
        staleSecs?: number
        timeoutSecs?: number
    }) {
        return scheduleSet({
            cronExpr: params.cronExpr,
            databaseClient: params.databaseClient,
            deduplicationId: params.deduplicationId ?? null,
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
        databaseClient: DatabaseClient
    }) {
        return scheduleClear({
            databaseClient: params.databaseClient,
            queueId: this.queueId,
            scheduleId: this.scheduleId,
            schema: this.schema,
        })
    }

}
