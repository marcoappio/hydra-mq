import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const jobChannelPolicyClear = async (params: {
    databaseClient: DatabaseClient
    schema: string,
    name: string,
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_channel_policy_clear(
            ${valueNode(params.name)}
        )
    `)
}
