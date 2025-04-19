import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDependencyResolveResultCode } from "@src/schema/message-dependency-resolve"

export type MessageDependencyResolveQueryResult =
    | { result_code: MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND }
    | { result_code: MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED }


export type MessageDependencyResolveResult =
    | { resultType: "MESSAGE_NOT_FOUND" }
    | { resultType: "MESSAGE_DEPENDENCY_RESOLVED" }

export const messageDependencyResolveQueryResultParse = (
    result: MessageDependencyResolveQueryResult
): MessageDependencyResolveResult => {
    if (result.result_code === MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.result_code === MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED) {
        return { resultType: "MESSAGE_DEPENDENCY_RESOLVED" }
    } else {
        throw new Error("Unexpected result")
    }
}

export const messageDependencyResolve = async (params: {
    databaseClient: DatabaseClient
    id: string,
    isSuccess: boolean
    schema: string
}): Promise<MessageDependencyResolveResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_dependency_resolve(
            ${valueNode(params.id)},
            ${valueNode(params.isSuccess)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageDependencyResolveQueryResult
    return messageDependencyResolveQueryResultParse(result)
}
