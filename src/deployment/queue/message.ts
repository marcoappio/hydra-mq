import { MESSAGE_NUM_ATTEMPTS, MESSAGE_PRIORITY, MESSAGE_STALE_SECS, MESSAGE_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { messageEnqueue } from "@src/driver/message-enqueue"

export type EnqueueResult =
    | { resultType: "QUEUE_CAPACITY_EXCEEDED" }
    | { messageId: string, resultType: "MESSAGE_ENQUEUED" | "MESSAGE_UPDATED" }

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
        databaseClient: DatabaseClient
        deduplicationId?: string
        numAttempts?: number
        payload: string
        priority?: number
        staleSecs?: number
        timeoutSecs?: number
    }): Promise<EnqueueResult> {
        return messageEnqueue({
            databaseClient: params.databaseClient,
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
