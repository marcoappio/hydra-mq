import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const jobMessageEnqueueScheduleClear = async (params: {
    databaseClient: DatabaseClient
    name: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_message_enqueue_schedule_clear(
            ${valueNode(params.name)}
        )
    `)
}
