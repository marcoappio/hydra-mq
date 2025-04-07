import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { MessageDequeueResultCode } from "@src/schema/message-dequeue/install"

type QueryResultQueueEmpty = {
    o_id: null
    o_channel_name: null
    o_num_attempts: null
    o_payload: null
    o_result_code: MessageDequeueResultCode.QUEUE_EMPTY
    o_num_dependencies_failed: null
}

type QueryResultMessageDequeued = {
    o_id: string
    o_channel_name: string
    o_num_attempts: number
    o_payload: string
    o_result_code: MessageDequeueResultCode.MESSAGE_DEQUEUED
    o_num_dependencies_failed: null
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultMessageDequeued

export type MessageDequeueMessage = {
    id: string
    channelName: string
    numAttempts: number
    payload: string
    isDependenciesMet: boolean
}

export type MessageDequeueResultMessageDequeued = {
    message: MessageDequeueMessage,
    resultType: "MESSAGE_DEQUEUED"
}

export type MessageDequeueResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

export type MessageDequeueResult =
    | MessageDequeueResultMessageDequeued
    | MessageDequeueResultQueueEmpty

export const messageDequeueParseQueryResult = (result: QueryResult): MessageDequeueResult => {
    if (result.o_result_code === MessageDequeueResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.o_result_code === MessageDequeueResultCode.MESSAGE_DEQUEUED) {
        return {
            message: {
                id: result.o_id,
                channelName: result.o_channel_name,
                numAttempts: result.o_num_attempts,
                payload: result.o_payload,
                isDependenciesMet: result.o_num_dependencies_failed === 0,
            },
            resultType: "MESSAGE_DEQUEUED",
        }
    } else {
        throw new Error("Unexpected result")
    }
}

export const messageDequeue = async (params: {
    databaseClient: DatabaseClient
    schema: string
}): Promise<MessageDequeueResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_dequeue()
    `).then(res => res.rows[0]) as QueryResult

    return messageDequeueParseQueryResult(result)
}
