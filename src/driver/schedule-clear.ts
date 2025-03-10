import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'

export const scheduleClear = async (params: {
    databaseClient: DatabaseClient
    queueId: string
    scheduleId: string
    schema: string
}) => {
    await params.databaseClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.schedule_remove(
            ${sql.value(params.scheduleId)},
            ${sql.value(params.queueId)}
        )
    `)
}
