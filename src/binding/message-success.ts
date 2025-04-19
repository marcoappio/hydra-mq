import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageSuccessResultCode } from "@src/schema/message-success"

type QueryResult =
    | { result_code: MessageSuccessResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageSuccessResultCode.MESSAGE_COMPLETED }

export type MessageSuccessResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_COMPLETED" }

export const messageSuccess = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string
}): Promise<MessageSuccessResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_success(
            ${valueNode(params.id)}
        ) AS result
    `).then(res => res.rows[0].result) as QueryResult
    if (result.result_code === MessageSuccessResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageSuccessResultCode.MESSAGE_COMPLETED) {
        return { resultType: "MESSAGE_COMPLETED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}
