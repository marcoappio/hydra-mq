import { MESSAGE_DEFAULT_NUM_ATTEMPTS, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_PROCESSING_SECS, MESSAGE_DEFAULT_LOCK_SECS, MESSAGE_DEFAULT_LOCK_SECS_FACTOR, MESSAGE_DEFAULT_DELAY_SECS, MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_DEPENDENCY_FAILURE_CASCADE } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { messageEnqueue } from "@src/schema/message-enqueue/binding"
import { MessageScheduleModule } from "@src/queue/channel/message/schedule"

export class ChannelMessageModule {

    private readonly schema: string
    private readonly channel: string | null

    constructor(params: {
        schema: string,
        channel: string | null
    }) {
        this.schema = params.schema
        this.channel = params.channel
    }

    schedule(scheduleId: string) {
        return new MessageScheduleModule({
            channel: this.channel,
            name: scheduleId,
            schema: this.schema,
        })
    }

    async enqueue(params: {
        databaseClient: DatabaseClient
        name?: string
        numAttempts?: number
        payload: string
        priority?: number
        channelPriority?: number
        lockSecs?: number
        maxProcessingSecs?: number
        lockSecsFactor?: number
        delaySecs?: number,
        dependsOn?: string[],
        dependencyFailureCascade?: boolean
    }) {
        return messageEnqueue({
            databaseClient: params.databaseClient,
            name: params.name ?? MESSAGE_DEFAULT_NAME,
            numAttempts: params.numAttempts ?? MESSAGE_DEFAULT_NUM_ATTEMPTS,
            payload: params.payload,
            priority: params.priority ?? MESSAGE_DEFAULT_PRIORITY,
            channelPriority: params.channelPriority ?? MESSAGE_DEFAULT_PRIORITY,
            channelName: this.channel,
            schema: this.schema,
            lockSecs: params.lockSecs ?? MESSAGE_DEFAULT_LOCK_SECS,
            lockSecsFactor: params.lockSecsFactor ?? MESSAGE_DEFAULT_LOCK_SECS_FACTOR,
            delaySecs: params.delaySecs ?? MESSAGE_DEFAULT_DELAY_SECS,
            maxProcessingSecs: params.maxProcessingSecs ?? MESSAGE_DEFAULT_PROCESSING_SECS,
            dependsOn: params.dependsOn ?? [],
            dependencyFailureCascade: params.dependencyFailureCascade ?? MESSAGE_DEFAULT_DEPENDENCY_FAILURE_CASCADE,
        })
    }

}
