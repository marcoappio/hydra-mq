import type { DatabaseClient } from "@src/core/database-client"
import { messageCreate } from "@src/binding/message-create"
import { MessageScheduleModule } from "@src/queue/channel/message/schedule"
import { MESSAGE_DEFAULT_NAME, MESSAGE_DEFAULT_PRIORITY, MESSAGE_DEFAULT_DELAY_MS, MESSAGE_DEFAULT_PROCESSING_MS } from "@src/core/config"

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
        payload: string
        priority?: number
        channelPriority?: number
        maxProcessingMs?: number
        delayMs?: number,
    }) {
        return await messageCreate({
            databaseClient: params.databaseClient,
            name: params.name ?? MESSAGE_DEFAULT_NAME,
            payload: params.payload,
            priority: params.priority ?? MESSAGE_DEFAULT_PRIORITY,
            channelPriority: params.channelPriority ?? MESSAGE_DEFAULT_PRIORITY,
            channelName: this.channel,
            schema: this.schema,
            delayMs: params.delayMs ?? MESSAGE_DEFAULT_DELAY_MS,
            maxProcessingMs: params.maxProcessingMs ?? MESSAGE_DEFAULT_PROCESSING_MS
        })
    }

}
