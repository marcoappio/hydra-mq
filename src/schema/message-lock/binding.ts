import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageLockResultCode } from "@src/schema/message-lock/install"

type QueryResult = {
    o_result_code:
        | MessageLockResultCode.MESSAGE_LOCKED
        | MessageLockResultCode.MESSAGE_NOT_FOUND
}

export type MessageLockResult = {
    resultType:
        | "MESSAGE_LOCKED"
        | "MESSAGE_NOT_FOUND"
}

export const messageLock = async (params: {
    databaseClient: DatabaseClient
    id: string
    schema: string
}): Promise<MessageLockResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_lock(
            ${valueNode(params.id)}
        )
    `).then(res => res.rows[0]) as QueryResult
    if (result.o_result_code === MessageLockResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === MessageLockResultCode.MESSAGE_LOCKED) {
        return { resultType: "MESSAGE_LOCKED" }
    } else {
        throw new Error("Unexpected result")
    }
}
