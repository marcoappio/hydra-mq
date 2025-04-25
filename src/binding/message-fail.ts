import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageFailResultCode } from "@src/schema/message-fail"

export type MessageFailQueryResult =
    | { result_code: MessageFailResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageFailResultCode.MESSAGE_STATUS_INVALID }
    | { result_code: MessageFailResultCode.MESSAGE_LOCKED }
    | { result_code: MessageFailResultCode.MESSAGE_EXHAUSTED }

export type MessageFailResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_STATUS_INVALID" }
    | { resultType: "MESSAGE_LOCKED" }
    | { resultType: "MESSAGE_EXHAUSTED" }

export const messageFailQueryResultParse = (result: MessageFailQueryResult): MessageFailResult => {
    if (result.result_code === MessageFailResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageFailResultCode.MESSAGE_STATUS_INVALID) {
        return { resultType: "MESSAGE_STATUS_INVALID" }
    } else if (result.result_code === MessageFailResultCode.MESSAGE_LOCKED) {
        return { resultType: "MESSAGE_LOCKED" }
    } else if (result.result_code === MessageFailResultCode.MESSAGE_EXHAUSTED) {
        return { resultType: "MESSAGE_EXHAUSTED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageFail = async (params: {
    databaseClient: DatabaseClient
    id: string
    exhaust: boolean
    schema: string
}): Promise<MessageFailResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_fail(
            ${valueNode(params.id)},
            ${valueNode(params.exhaust)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageFailQueryResult
    return messageFailQueryResultParse(result)
}
