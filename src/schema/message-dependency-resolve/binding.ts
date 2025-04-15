import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDependencyResolveResultCode } from "@src/schema/message-dependency-resolve/install"

export type MessageDependencyResolveQueryResult = {
    o_result_code:
        | MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND
        | MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED
}

export type MessageDependencyResolveResultMessageNotFound = {
    resultType: "MESSAGE_NOT_FOUND"
}

export type MessageDependencyResolveResultMessageDependencyResolved = {
    resultType: "MESSAGE_DEPENDENCY_RESOLVED"
}

export type MessageDependencyResolveResult =
    | MessageDependencyResolveResultMessageNotFound
    | MessageDependencyResolveResultMessageDependencyResolved

export const messageDependencyResolveParseQueryResult = (
    result: MessageDependencyResolveQueryResult
): MessageDependencyResolveResult => {
    if (result.o_result_code === MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED) {
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
        )
    `).then(res => res.rows[0]) as MessageDependencyResolveQueryResult
    return messageDependencyResolveParseQueryResult(result)
}
