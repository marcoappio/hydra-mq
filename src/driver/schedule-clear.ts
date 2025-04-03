import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const scheduleClear = async (params: {
    databaseClient: DatabaseClient
    groupId: string
    queueId: string
    scheduleId: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.schedule_remove(
            ${valueNode(params.groupId)},
            ${valueNode(params.queueId)},
            ${valueNode(params.scheduleId)}
        )
    `)
}
