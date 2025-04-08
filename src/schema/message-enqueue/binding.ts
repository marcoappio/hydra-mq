import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"
import { MessageEnqueueResultCode } from "@src/schema/message-enqueue/install"

export type MessageEnqueueResultMessageEnqueued = {
    messageId: string
    resultType: "MESSAGE_ENQUEUED"
}

export type MessageEnqueueResultMessageDeduplicated = {
    messageId: string
    resultType: "MESSAGE_DEDUPLICATED"
}

export type MessageEnqueueResultMessageDependencyNotFound = {
    resultType: "MESSAGE_DEPENDENCY_NOT_FOUND"
}

type QueryResultMessageEnqueued = {
    o_id: string
    o_result_code: MessageEnqueueResultCode.MESSAGE_ENQUEUED
}

type QueryResultMessageUpdated = {
    o_id: string
    o_result_code: MessageEnqueueResultCode.MESSAGE_DEDUPLICATED
}

type QueryResultMessageDependencyNotFound = {
    o_id: null
    o_result_code: MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND
}

export type MessageEnqueueResult =
    | MessageEnqueueResultMessageEnqueued
    | MessageEnqueueResultMessageDeduplicated
    | MessageEnqueueResultMessageDependencyNotFound

type QueryResult =
    | QueryResultMessageEnqueued
    | QueryResultMessageUpdated
    | QueryResultMessageDependencyNotFound

export const messageEnqueueParseQueryResult = (result : QueryResult): MessageEnqueueResult => {
    if (result.o_result_code === MessageEnqueueResultCode.MESSAGE_ENQUEUED) {
        return { messageId: result.o_id, resultType: "MESSAGE_ENQUEUED" }
    } else if (result.o_result_code === MessageEnqueueResultCode.MESSAGE_DEDUPLICATED) {
        return { messageId: result.o_id, resultType: "MESSAGE_DEDUPLICATED" }
    } else if (result.o_result_code === MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND) {
        return { resultType: "MESSAGE_DEPENDENCY_NOT_FOUND" }
    } else {
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
    numAttempts: number
    maxProcessingSecs: number
    lockSecs: number
    lockSecsFactor: number
    delaySecs: number,
    dependsOn: string[],
    dependencyFailureCascade: boolean
}): Promise<MessageEnqueueResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_enqueue(
            ${valueNode(params.name)},
            ${valueNode(params.channelName)},
            ${valueNode(params.payload)},
            ${valueNode(params.priority)},
            ${valueNode(params.numAttempts)},
            ${valueNode(params.maxProcessingSecs)},
            ${valueNode(params.lockSecs)},
            ${valueNode(params.lockSecsFactor)},
            ${valueNode(params.delaySecs)},
            ${arrayNode(params.dependsOn)}::UUID[],
            ${valueNode(params.dependencyFailureCascade)}
        )
    `).then(res => res.rows[0]) as QueryResult

    return messageEnqueueParseQueryResult(result)
}
