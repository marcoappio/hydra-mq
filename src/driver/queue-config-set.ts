import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const queueConfigSet = async (params: {
    databaseClient: DatabaseClient
    maxCapacity: number | null
    maxConcurrency: number | null
    groupId: string
    queueId: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.queue_config_set(
            ${valueNode(params.groupId)},
            ${valueNode(params.queueId)},
            ${valueNode(params.maxConcurrency)},
            ${valueNode(params.maxCapacity)}
        )
    `)
}
