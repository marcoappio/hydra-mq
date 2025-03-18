import type { DatabaseClient } from "@src/core/database-client"
import { queueConfigClear } from "@src/driver/queue-config-clear"
import { queueConfigSet } from "@src/driver/queue-config-set"

export class QueueConfigModule {

    private readonly schema: string
    private readonly queueId: string
    private readonly groupId: string

    constructor(params: {
        queueId: string
        groupId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
        this.groupId = params.groupId
    }

    async set(params: {
        databaseClient: DatabaseClient
        maxCapacity: number | null
        maxConcurrency: number | null
    }) {
        return queueConfigSet({
            groupId: this.groupId,
            databaseClient: params.databaseClient,
            maxCapacity: params.maxCapacity,
            maxConcurrency: params.maxConcurrency,
            queueId: this.queueId,
            schema: this.schema,
        })
    }

    async clear(params: {
        databaseClient: DatabaseClient
    }) {
        return queueConfigClear({
            groupId: this.groupId,
            databaseClient: params.databaseClient,
            queueId: this.queueId,
            schema: this.schema,
        })
    }

}
