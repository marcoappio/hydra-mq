import type { DatabaseClient } from '@src/core/database-client'
import { queueConfigClear } from '@src/driver/queue-config-clear'
import { queueConfigSet } from '@src/driver/queue-config-set'

export class QueueConfigNamespace {

    private readonly schema: string
    private readonly queueId: string

    constructor(params: {
        queueId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
    }

    async set(params: {
        dbClient: DatabaseClient
        maxCapacity: number | null
        maxConcurrency: number | null
    }) {
        return queueConfigSet({
            dbClient: params.dbClient,
            maxCapacity: params.maxCapacity,
            maxConcurrency: params.maxConcurrency,
            queueId: this.queueId,
            schema: this.schema,
        })
    }

    async clear(params: {
        dbClient: DatabaseClient
    }) {
        return queueConfigClear({
            dbClient: params.dbClient,
            queueId: this.queueId,
            schema: this.schema,
        })
    }

}
