import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageSuccessResultCode } from "@src/schema/message-success"

type QueryResult =
    | { result_code: MessageSuccessResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageSuccessResultCode.MESSAGE_STATUS_INVALID }
    | { result_code: MessageSuccessResultCode.MESSAGE_SUCCEEDED }

export type MessageSuccessResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_STATUS_INVALID" }
    | { resultType: "MESSAGE_SUCCEEDED" }

export const messageSuccess = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string,
    result: string | null
}): Promise<MessageSuccessResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_success(
            ${valueNode(params.id)},
            ${valueNode(params.result)}
        ) AS result
    `).then(res => res.rows[0].result) as QueryResult
    if (result.result_code === MessageSuccessResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageSuccessResultCode.MESSAGE_STATUS_INVALID) {
        return { resultType: "MESSAGE_STATUS_INVALID" }
    } else if (result.result_code === MessageSuccessResultCode.MESSAGE_SUCCEEDED) {
        return { resultType: "MESSAGE_SUCCEEDED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}
