import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'

export const queueConfigClear = async (params: {
    databaseClient: DatabaseClient
    queueId: string
    schema: string
}) => {
    await params.databaseClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.queue_remove(
            ${sql.value(params.queueId)}
        )
    `)
}
