import { MESSAGE_DEFAULT_NUM_ATTEMPTS, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_PROCESSING_SECS, MESSAGE_DEFAULT_LOCK_SECS, MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_DELAY_SECS, MESSAGE_DEFAULT_LOCK_SECS_FACTOR } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { jobMessageEnqueueScheduleClear } from "@src/schema/job-message-enqueue-schedule-clear/binding"
import { jobMessageEnqueueScheduleSet } from "@src/schema/job-message-enqueue-schedule-set/binding"
import { createHash } from "crypto"

export const getUniqueJobName = (params: {
    channel: string | null
    name: string
}) => {
    return createHash("sha256")
        .update(JSON.stringify(params.channel))
        .update(params.name)
        .digest("hex")

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
        lockSecs?: number
        lockSecsFactor?: number
        delaySecs?: number
    }) {
        return jobMessageEnqueueScheduleSet({
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
                maxProcessingSecs: MESSAGE_DEFAULT_PROCESSING_SECS,
                lockSecs: params.lockSecs ?? MESSAGE_DEFAULT_LOCK_SECS,
                lockSecsFactor: params.lockSecsFactor ?? MESSAGE_DEFAULT_LOCK_SECS_FACTOR,
                delaySecs: params.delaySecs ?? MESSAGE_DEFAULT_DELAY_SECS,
            }
        })
    }

    async clear(params: {
        databaseClient: DatabaseClient
    }) {
        return jobMessageEnqueueScheduleClear({
            databaseClient: params.databaseClient,
            name: this.jobName,
            schema: this.schema,
        })
    }

}
