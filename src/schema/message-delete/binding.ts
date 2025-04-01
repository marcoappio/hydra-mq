import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDeleteResultCode } from "@src/schema/message-delete/install"

type QueryResult = {
    o_result_code: 
        | MessageDeleteResultCode.MESSAGE_DELETED
        | MessageDeleteResultCode.MESSAGE_NOT_FOUND
}

export type MessageDeleteResult = {
    resultType: 
        | "MESSAGE_DELETED"
        | "MESSAGE_NOT_FOUND"
}

export const messageDeleteParseQueryResult = (result: QueryResult): MessageDeleteResult => {
    if (result.o_result_code === MessageDeleteResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === MessageDeleteResultCode.MESSAGE_DELETED) {
        return { resultType: "MESSAGE_DELETED" }
    } else {
        throw new Error("Unexpected result")
    }
}

export const messageDelete = async (params: {
    databaseClient: DatabaseClient
    id: string,
    isSuccess: boolean,
    schema: string
}): Promise<MessageDeleteResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_lock(
            ${valueNode(params.id)},
            ${valueNode(params.isSuccess)}
        )
    `).then(res => res.rows[0]) as QueryResult
    return messageDeleteParseQueryResult(result)
}
