import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDeleteResultCode } from "@src/schema/message-delete"

type QueryResult =
    | { result_code: MessageDeleteResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageDeleteResultCode.MESSAGE_STATUS_INVALID }
    | { result_code: MessageDeleteResultCode.MESSAGE_DELETED }

export type MessageDeleteResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_STATUS_INVALID" }
    | { resultType: "MESSAGE_DELETED" }

export const messageDelete = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string
}): Promise<MessageDeleteResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_delete(
            ${valueNode(params.id)}
        ) AS result
    `).then(res => res.rows[0].result) as QueryResult
    if (result.result_code === MessageDeleteResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageDeleteResultCode.MESSAGE_STATUS_INVALID) {
        return { resultType: "MESSAGE_STATUS_INVALID" }
    } else if (result.result_code === MessageDeleteResultCode.MESSAGE_DELETED) {
        return { resultType: "MESSAGE_DELETED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}
