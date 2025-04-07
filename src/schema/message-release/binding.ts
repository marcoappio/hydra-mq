import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageReleaseResultCode } from "@src/schema/message-release/install"

type QueryResult = {
    o_result_code: 
        | MessageReleaseResultCode.MESSAGE_NOT_FOUND
        | MessageReleaseResultCode.MESSAGE_DROPPED
        | MessageReleaseResultCode.MESSAGE_RELEASED
}

export type MessageReleaseResultMessageReleased = {
    resultType: "MESSAGE_RELEASED"
}

export type MessageReleaseResultMessageDropped = {
    resultType: "MESSAGE_DROPPED"
}

export type MessageReleaseResultMessageNotFound = {
    resultType: "MESSAGE_NOT_FOUND"
}

export type MessageReleaseResult =
    | MessageReleaseResultMessageReleased
    | MessageReleaseResultMessageDropped
    | MessageReleaseResultMessageNotFound

export const messageReleaseParseQueryResult = (result: QueryResult): MessageReleaseResult => {
    if(result.o_result_code === MessageReleaseResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if(result.o_result_code === MessageReleaseResultCode.MESSAGE_DROPPED) {
        return { resultType: "MESSAGE_DROPPED" }
    } else if(result.o_result_code === MessageReleaseResultCode.MESSAGE_RELEASED) {
        return { resultType: "MESSAGE_RELEASED" }
    } else {
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
        )
    `).then(res => res.rows[0]) as QueryResult
    return messageReleaseParseQueryResult(result)
}
