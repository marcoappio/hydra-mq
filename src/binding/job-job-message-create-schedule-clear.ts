import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const jobJobMessageCreateScheduleClear = async (params: {
    databaseClient: DatabaseClient
    name: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_job_message_create_schedule_clear(
            ${valueNode(params.name)}
        )
    `)
}
