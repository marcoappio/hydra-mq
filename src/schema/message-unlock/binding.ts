import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageUnlockResultCode } from "@src/schema/message-unlock/install"

export type MessageUnlockResult = {
    resultType:
        | "MESSAGE_NOT_FOUND"
        | "MESSAGE_UNLOCKED"
}

export type QueryResult = {
    o_result_code:
        | MessageUnlockResultCode.MESSAGE_NOT_FOUND
        | MessageUnlockResultCode.MESSAGE_UNLOCKED
}

export const messageUnlockParseQueryResult = (result: QueryResult): MessageUnlockResult => {
    if (result.o_result_code === MessageUnlockResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === MessageUnlockResultCode.MESSAGE_UNLOCKED) {
        return { resultType: "MESSAGE_UNLOCKED" }
    } else {
        throw new Error("Unexpected result")
    }
}

export const messageUnlock = async (params: {
    databaseClient: DatabaseClient
    schema: string,
    id: string
}): Promise<MessageUnlockResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_unlock(
            ${valueNode(params.id)}
        )
    `).then(res => res.rows[0]) as QueryResult
    return messageUnlockParseQueryResult(result)
}
