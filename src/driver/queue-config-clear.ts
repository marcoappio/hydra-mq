import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const queueConfigClear = async (params: {
    databaseClient: DatabaseClient
    groupId: string
    queueId: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.queue_remove(
            ${valueNode(params.groupId)},
            ${valueNode(params.queueId)}
        )
    `)
}
