import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const channelPolicyClear = async (params: {
    databaseClient: DatabaseClient
    name: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.channel_policy_clear(
            ${valueNode(params.name)}
        )
    `)
}
