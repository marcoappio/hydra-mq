import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export const jobControlSet = async (params: {
    databaseClient: DatabaseClient
    schema: string,
    id: string,
    isSuccess: boolean,
    data: string | null
}) => {
    await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_control_set(
            ${valueNode(params.id)},
            ${valueNode(params.isSuccess)},
            ${valueNode(params.data)}
        )
    `)
}
