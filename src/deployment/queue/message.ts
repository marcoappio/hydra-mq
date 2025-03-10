import { MESSAGE_NUM_ATTEMPTS, MESSAGE_PRIORITY, MESSAGE_STALE_SECS, MESSAGE_TIMEOUT_SECS } from '@src/core/config'
import type { DatabaseClient } from '@src/core/database-client'
import { messageEnqueue } from '@src/driver/message-enqueue'

export class QueueMessageNamespace {

    private readonly schema: string
    private readonly queueId: string

    constructor(params: {
        queueId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
    }

    async enqueue(params: {
        dbClient: DatabaseClient
        deduplicationId?: string
        numAttempts?: number
        payload: string
        priority?: number
        staleSecs?: number
        timeoutSecs?: number
    }) {
        return messageEnqueue({
            dbClient: params.dbClient,
            deduplicationId: params.deduplicationId ?? null,
            numAttempts: params.numAttempts ?? MESSAGE_NUM_ATTEMPTS,
            payload: params.payload,
            priority: params.priority ?? MESSAGE_PRIORITY,
            queueId: this.queueId,
            schema: this.schema,
            staleSecs: params.staleSecs ?? MESSAGE_STALE_SECS,
            timeoutSecs: params.timeoutSecs ?? MESSAGE_TIMEOUT_SECS,
        })
    }

}
