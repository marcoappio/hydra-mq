import { MESSAGE_DEFAULT_NUM_ATTEMPTS, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_PROCESSING_MS, MESSAGE_DEFAULT_LOCK_MS, MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_DELAY_MS, MESSAGE_DEFAULT_LOCK_MS_FACTOR, MESSAGE_DEFAULT_DELETE_MS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { jobJobMessageCreateScheduleClear } from "@src/binding/job-job-message-create-schedule-clear"
import { jobJobMessageCreateScheduleSet } from "@src/binding/job-job-message-create-schedule-set"
import { createHash } from "crypto"

export const getUniqueJobName = (params: {
    channel: string | null
    name: string
}) => {
    const suffix = createHash("sha256")
        .update(JSON.stringify(params.channel))
        .update(params.name)
        .digest("hex")
        .slice(0, 8)

    return [
        "schedule",
        params.channel,
        params.name,
        suffix
    ].filter(Boolean).join("-")

}

export class MessageScheduleModule {
    private readonly schema: string
    private readonly channel: string | null
    private readonly jobName: string

    constructor(params: {
        channel: string | null
        name: string
        schema: string
    }) {
        this.schema = params.schema
        this.channel = params.channel
        this.jobName = getUniqueJobName({
            channel: params.channel,
            name: params.name
        })
    }

    async set(params: {
        cronExpr: string
        databaseClient: DatabaseClient
        name?: string
        numAttempts?: number
        payload: string
        priority?: number
        channelPriority?: number
        lockMs?: number
        maxProcessingMs?: number
        lockMsFactor?: number
        delayMs?: number
        deleteMs?: number
    }) {
        return jobJobMessageCreateScheduleSet({
            cronExpr: params.cronExpr,
            databaseClient: params.databaseClient,
            schema: this.schema,
            name: this.jobName,
            message: {
                name: params.name ?? MESSAGE_DEFAULT_NAME,
                channelName: this.channel,
                payload: params.payload,
                priority: params.priority ?? MESSAGE_DEFAULT_PRIORITY,
                channelPriority: params.channelPriority ?? MESSAGE_DEFAULT_PRIORITY,
                numAttempts: params.numAttempts ?? MESSAGE_DEFAULT_NUM_ATTEMPTS,
                maxProcessingMs: params.maxProcessingMs ?? MESSAGE_DEFAULT_PROCESSING_MS,
                lockMs: params.lockMs ?? MESSAGE_DEFAULT_LOCK_MS,
                lockMsFactor: params.lockMsFactor ?? MESSAGE_DEFAULT_LOCK_MS_FACTOR,
                delayMs: params.delayMs ?? MESSAGE_DEFAULT_DELAY_MS,
                deleteMs: params.deleteMs ?? MESSAGE_DEFAULT_DELETE_MS,
            }
        })
    }

    async clear(params: {
        databaseClient: DatabaseClient
    }) {
        return jobJobMessageCreateScheduleClear({
            databaseClient: params.databaseClient,
            name: this.jobName,
            schema: this.schema,
        })
    }

}
