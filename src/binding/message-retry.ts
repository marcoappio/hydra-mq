import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageRetryResultCode } from "@src/schema/message-retry"

export type MessageRetryQueryResult =
    | { result_code: MessageRetryResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageRetryResultCode.MESSAGE_STATUS_INVALID }
    | { result_code: MessageRetryResultCode.MESSAGE_LOCKED }
    | { result_code: MessageRetryResultCode.MESSAGE_ACCEPTED }

export type MessageRetryResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_STATUS_INVALID" }
    | { resultType: "MESSAGE_LOCKED" }
    | { resultType: "MESSAGE_ACCEPTED" }

export const messageRetryQueryResultParse = (result: MessageRetryQueryResult): MessageRetryResult => {
    if (result.result_code === MessageRetryResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageRetryResultCode.MESSAGE_STATUS_INVALID) {
        return { resultType: "MESSAGE_STATUS_INVALID" }
    } else if (result.result_code === MessageRetryResultCode.MESSAGE_LOCKED) {
        return { resultType: "MESSAGE_LOCKED" }
    } else if (result.result_code === MessageRetryResultCode.MESSAGE_ACCEPTED) {
        return { resultType: "MESSAGE_ACCEPTED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageRetry = async (params: {
    databaseClient: DatabaseClient
    id: string
    lockMs: number
    schema: string
}): Promise<MessageRetryResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_retry(
            ${valueNode(params.id)},
            ${valueNode(params.lockMs)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageRetryQueryResult
    return messageRetryQueryResultParse(result)
}
