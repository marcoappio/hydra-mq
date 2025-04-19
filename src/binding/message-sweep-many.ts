import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"

export type MessageSweepManyResult = {
    ids: string[]
}

export type MessageSweepManyQueryResult = {
    ids: string[]
}

export const messageSweepMany = async (params: {
    databaseClient: DatabaseClient
    schema: string,
}): Promise<MessageSweepManyResult> => {
    return await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_sweep_many(
        ) AS result
    `).then(res => res.rows[0].result) as MessageSweepManyQueryResult
}

