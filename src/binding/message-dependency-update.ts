import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDependencyUpdateResultCode } from "@src/schema/message-dependency-update"

export type MessageDependencyUpdateQueryResult =
    | { result_code: MessageDependencyUpdateResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageDependencyUpdateResultCode.MESSAGE_STATUS_INVALID }
    | { result_code: MessageDependencyUpdateResultCode.MESSAGE_DEPENDENCY_UPDATED }


export type MessageDependencyUpdateResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_STATUS_INVALID" }
    | { resultType: "MESSAGE_DEPENDENCY_UPDATED" }

export const messageDependencyUpdateQueryResultParse = (
    result: MessageDependencyUpdateQueryResult
): MessageDependencyUpdateResult => {
    if (result.result_code === MessageDependencyUpdateResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageDependencyUpdateResultCode.MESSAGE_DEPENDENCY_UPDATED) {
        return { resultType: "MESSAGE_DEPENDENCY_UPDATED" }
    } else if (result.result_code === MessageDependencyUpdateResultCode.MESSAGE_STATUS_INVALID) {
        return { resultType: "MESSAGE_STATUS_INVALID" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageDependencyUpdate = async (params: {
    databaseClient: DatabaseClient
    id: string,
    schema: string
}): Promise<MessageDependencyUpdateResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_dependency_update(
            ${valueNode(params.id)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageDependencyUpdateQueryResult
    return messageDependencyUpdateQueryResultParse(result)
}
