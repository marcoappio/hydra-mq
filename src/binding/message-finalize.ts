import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageFinalizeResultCode } from "@src/schema/message-finalize"

export type MessageFinalizeQueryResult =
    | { result_code: MessageFinalizeResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageFinalizeResultCode.MESSAGE_DELETED }

export type MessageFinalizeResult =
    | { resultType: "MESSAGE_DELETED" }
    | { resultType: "MESSAGE_NOT_FOUND" }

export const messageFinalizeQueryResultParse = (result : MessageFinalizeQueryResult) : MessageFinalizeResult => {
    if (result.result_code === MessageFinalizeResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageFinalizeResultCode.MESSAGE_DELETED) {
        return { resultType: "MESSAGE_DELETED" }
    } else {
        throw new Error("Unexpected result")
    }
}

export const messageFinalize = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string
}): Promise<MessageFinalizeResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_finalize(
            ${valueNode(params.id)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageFinalizeQueryResult
    return messageFinalizeQueryResultParse(result)
}
