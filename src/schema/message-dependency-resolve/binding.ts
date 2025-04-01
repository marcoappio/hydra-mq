import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { MessageDependencyResolveResultCode } from "@src/schema/message-dependency-resolve/install"

type QueryResult = {
    o_result_code: 
        | MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND
        | MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED
}

export type MessageDependencyResolveResult = {
    resultType: 
        | "MESSAGE_NOT_FOUND"
        | "MESSAGE_DEPENDENCY_RESOLVED"
}

export const messageDependencyResolveParseQueryResult = (
    result: QueryResult
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
    isFailure: boolean
    schema: string
}): Promise<MessageDependencyResolveResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_dependency_resolve(
            ${valueNode(params.id)},
            ${valueNode(params.isFailure)}
        )
    `).then(res => res.rows[0]) as QueryResult
    return messageDependencyResolveParseQueryResult(result)
}
