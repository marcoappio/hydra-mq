import type { DatabaseClient } from "@src/core/database-client"
import { sql } from "@src/core/sql"

export const queueConfigSet = async (params: {
    databaseClient: DatabaseClient
    maxCapacity: number | null
    maxConcurrency: number | null
    queueId: string
    schema: string
}) => {
    await params.databaseClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.queue_config_set(
            ${sql.value(params.queueId)},
            ${sql.value(params.maxConcurrency)},
            ${sql.value(params.maxCapacity)}
        )
    `)
}
