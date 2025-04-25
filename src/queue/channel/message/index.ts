import type { DatabaseClient } from "@src/core/database-client"
import { messageCreate } from "@src/binding/message-create"
import { MessageScheduleModule } from "@src/queue/channel/message/schedule"
import { MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_NUM_ATTEMPTS, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_LOCK_MS, MESSAGE_DEFAULT_LOCK_MS_FACTOR, MESSAGE_DEFAULT_DELAY_MS, MESSAGE_DEFAULT_PROCESSING_MS, MESSAGE_DEFAULT_DELETE_MS } from "@src/core/config"

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

    async create(params: {
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
        deleteMs?: number,
        dependsOn?: string[],
    }) {
        return await messageCreate({
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
            deleteMs: params.deleteMs ?? MESSAGE_DEFAULT_DELETE_MS,
        })
    }

}
