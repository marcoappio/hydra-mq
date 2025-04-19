import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageReleaseResultCode } from "@src/schema/message-release"

export type MessageReleaseQueryResult =
    | { result_code: MessageReleaseResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageReleaseResultCode.MESSAGE_ACCEPTED }
    | { result_code: MessageReleaseResultCode.MESSAGE_DEDUPLICATED }
    | { result_code: MessageReleaseResultCode.MESSAGE_DROPPED }
    | { result_code: MessageReleaseResultCode.MESSAGE_UNSATISFIED }

export type MessageReleaseResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_ACCEPTED" }
    | { resultType: "MESSAGE_DEDUPLICATED" }
    | { resultType: "MESSAGE_DROPPED" }
    | { resultType: "MESSAGE_UNSATISFIED" }

export const messageReleaseQueryResultParse = (result: MessageReleaseQueryResult): MessageReleaseResult => {
    if (result.result_code === MessageReleaseResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageReleaseResultCode.MESSAGE_ACCEPTED) {
        return { resultType: "MESSAGE_ACCEPTED" }
    } else if (result.result_code === MessageReleaseResultCode.MESSAGE_DEDUPLICATED) {
        return { resultType: "MESSAGE_DEDUPLICATED" }
    } else if (result.result_code === MessageReleaseResultCode.MESSAGE_DROPPED) {
        return { resultType: "MESSAGE_DROPPED" }
    } else if (result.result_code === MessageReleaseResultCode.MESSAGE_UNSATISFIED) {
        return { resultType: "MESSAGE_UNSATISFIED" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageRelease = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string
}) : Promise<MessageReleaseResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_release(
            ${valueNode(params.id)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageReleaseQueryResult
    return messageReleaseQueryResultParse(result)
}
