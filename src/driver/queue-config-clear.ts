import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'

export const queueConfigClear = async (params: {
    dbClient: DatabaseClient
    queueId: string
    schema: string
}) => {
    await params.dbClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.queue_remove(
            ${sql.value(params.queueId)}
        )
    `)
}
