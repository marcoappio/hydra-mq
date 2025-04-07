import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageFinalizeResultCode } from "@src/schema/message-finalize/install"

type QueryResult = {
    o_result_code:
        | MessageFinalizeResultCode.MESSAGE_NOT_FOUND
        | MessageFinalizeResultCode.MESSAGE_FINALIZED
}

export type MessageFinalizeResultMessageFinalized = {
    resultType: "MESSAGE_FINALIZED"
}

export type MessageFinalizeResultMessageNotFound = {
    resultType: "MESSAGE_NOT_FOUND"
}

export type MessageFinalizeResult =
    | MessageFinalizeResultMessageFinalized
    | MessageFinalizeResultMessageNotFound

export const messageFinalize = async (params: {
    databaseClient: DatabaseClient
    id: string
    isSuccess: boolean
    schema: string
}): Promise<MessageFinalizeResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_finalize(
            ${valueNode(params.id)},
            ${valueNode(params.isSuccess)}
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === MessageFinalizeResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === MessageFinalizeResultCode.MESSAGE_FINALIZED) {
        return { resultType: "MESSAGE_FINALIZED" }
    } else {
        throw new Error("Unexpected result")
    }
}
