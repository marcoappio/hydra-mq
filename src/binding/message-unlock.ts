import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageUnlockResultCode } from "@src/schema/message-unlock"

export type MessageUnlockResult =
    | { resultType: "MESSAGE_ACCEPTED" }
    | { resultType: "MESSAGE_NOT_FOUND" }

export type MessageUnlockQueryResult =
    | { result_code: MessageUnlockResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageUnlockResultCode.MESSAGE_ACCEPTED }

export const messageUnlockQueryResultParse = (result: MessageUnlockQueryResult): MessageUnlockResult => {
    if (result.result_code === MessageUnlockResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageUnlockResultCode.MESSAGE_ACCEPTED) {
        return { resultType: "MESSAGE_ACCEPTED" }
    } else {
        result satisfies never
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
        ) AS result
    `).then(res => res.rows[0].result) as MessageUnlockQueryResult
    return messageUnlockQueryResultParse(result)
}
