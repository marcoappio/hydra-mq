import { MESSAGE_DEFAULT_NUM_ATTEMPTS, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_PROCESSING_MS, MESSAGE_DEFAULT_LOCK_MS, MESSAGE_DEFAULT_LOCK_MS_FACTOR, MESSAGE_DEFAULT_DELAY_MS, MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_DEPENDENCY_FAILURE_CASCADE } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { messageEnqueue } from "@src/binding/message-enqueue"
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
        lockMs?: number
        maxProcessingMs?: number
        lockMsFactor?: number
        delayMs?: number,
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
            lockMs: params.lockMs ?? MESSAGE_DEFAULT_LOCK_MS,
            lockMsFactor: params.lockMsFactor ?? MESSAGE_DEFAULT_LOCK_MS_FACTOR,
            delayMs: params.delayMs ?? MESSAGE_DEFAULT_DELAY_MS,
            maxProcessingMs: params.maxProcessingMs ?? MESSAGE_DEFAULT_PROCESSING_MS,
            dependsOn: params.dependsOn ?? [],
            dependencyFailureCascade: params.dependencyFailureCascade ?? MESSAGE_DEFAULT_DEPENDENCY_FAILURE_CASCADE,
        })
    }

}
