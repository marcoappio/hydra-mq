import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"

export type MessagesSweepResult = {
    messageIds: string[]
}

type QueryResult = {
    o_message_ids: string[]
}

export const messageUnlock = async (params: {
    databaseClient: DatabaseClient
    schema: string,
    id: string
}): Promise<MessagesSweepResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_unlock(
            ${valueNode(params.id)}
        )
    `).then(res => res.rows[0]) as QueryResult
    return { messageIds: result.o_message_ids }
}

