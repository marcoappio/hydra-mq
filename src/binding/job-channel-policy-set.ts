import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const jobChannelPolicySet = async (params: {
    databaseClient: DatabaseClient
    maxConcurrency: number | null
    maxSize: number | null
    name: string
    schema: string
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_channel_policy_set(
            ${valueNode(params.name)},
            ${valueNode(params.maxSize)},
            ${valueNode(params.maxConcurrency)}
        )
    `)
}
