import { MESSAGE_NUM_ATTEMPTS, MESSAGE_PRIORITY, MESSAGE_STALE_SECS, MESSAGE_TIMEOUT_SECS } from "@src/core/config"
import type { DatabaseClient } from "@src/core/database-client"
import { QueueConfigModule } from "@src/deployment/group/queue/config"
import { Schedule } from "@src/deployment/group/queue/schedule"
import { messageEnqueue } from "@src/driver/message-enqueue"
import type { DriverResult as EnqueueResult } from "@src/driver/message-enqueue"

export class Queue {

    private readonly schema: string
    private readonly queueId: string
    private readonly groupId: string
    readonly config: QueueConfigModule

    constructor(params: {
        queueId: string
        groupId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
        this.groupId = params.groupId

        this.config = new QueueConfigModule({
            queueId: this.queueId,
            groupId: this.groupId,
            schema: this.schema,
        })
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
            groupId: this.groupId,
            schema: this.schema,
            staleSecs: params.staleSecs ?? MESSAGE_STALE_SECS,
            timeoutSecs: params.timeoutSecs ?? MESSAGE_TIMEOUT_SECS,
        })
    }

    schedule(scheduleId: string) {
        return new Schedule({
            queueId: this.queueId,
            scheduleId: scheduleId,
            groupId: this.groupId,
            schema: this.schema,
        })
    }

}
