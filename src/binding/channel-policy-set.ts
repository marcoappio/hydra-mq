import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const channelPolicySet = async (params: {
    databaseClient: DatabaseClient
    maxConcurrency: number
    name: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.channel_policy_set(
            ${valueNode(params.name)},
            ${valueNode(params.maxConcurrency)}
        )
    `)
}
