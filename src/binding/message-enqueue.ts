import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"
import { MessageEnqueueResultCode } from "@src/schema/message-enqueue"

type QueryResultMessageEnqueued = {
    id: string
    result_code: MessageEnqueueResultCode.MESSAGE_ENQUEUED
}

type QueryResultMessageDependencyNotFound = {
    result_code: MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND
}

export type MessageEnqueueResultMessageEnqueued = {
    messageId: string
    resultType: "MESSAGE_ENQUEUED"
}

export type MessageEnqueueResultMessageDependencyNotFound = {
    resultType: "MESSAGE_DEPENDENCY_NOT_FOUND",
}

export type MessageEnqueueResult =
    | MessageEnqueueResultMessageEnqueued
    | MessageEnqueueResultMessageDependencyNotFound

export type MessageEnqueueQueryResult =
    | QueryResultMessageEnqueued
    | QueryResultMessageDependencyNotFound

export const messageEnqueueQueryResultParse = (result : MessageEnqueueQueryResult): MessageEnqueueResult => {
    if (result.result_code === MessageEnqueueResultCode.MESSAGE_ENQUEUED) {
        return { messageId: result.id, resultType: "MESSAGE_ENQUEUED" }
    } else if (result.result_code === MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND) {
        return { resultType: "MESSAGE_DEPENDENCY_NOT_FOUND" }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageEnqueue = async (params: {
    databaseClient: DatabaseClient
    schema: string
    name: string | null
    channelName: string | null
    payload: string
    priority: number | null
    channelPriority: number | null
    numAttempts: number
    maxProcessingMs: number
    lockMs: number
    lockMsFactor: number
    delayMs: number,
    dependsOn: string[],
    dependencyFailureCascade: boolean
}): Promise<MessageEnqueueResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_enqueue(
            ${valueNode(params.name)},
            ${valueNode(params.channelName)},
            ${valueNode(params.payload)},
            ${valueNode(params.priority)},
            ${valueNode(params.channelPriority)},
            ${valueNode(params.numAttempts)},
            ${valueNode(params.maxProcessingMs)},
            ${valueNode(params.lockMs)},
            ${valueNode(params.lockMsFactor)},
            ${valueNode(params.delayMs)},
            ${arrayNode(params.dependsOn)}::UUID[],
            ${valueNode(params.dependencyFailureCascade)}
        ) AS result
    `).then(res => res.rows[0].result) as MessageEnqueueQueryResult

    return messageEnqueueQueryResultParse(result)
}
