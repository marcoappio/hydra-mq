import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { MessageDequeueResultCode } from "@src/schema/message-dequeue"

type QueryResultQueueEmpty = {
    result_code: MessageDequeueResultCode.QUEUE_EMPTY
}

type QueryResultMessageDequeued = {
    id: string
    name: string
    channel_name: string
    payload: string
    priority: number | null
    channel_priority: number | null
    num_attempts: number
    result_code: MessageDequeueResultCode.MESSAGE_DEQUEUED
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultMessageDequeued

export type MessageDequeueResultMessageDequeued = {
    id: string
    name: string
    channelName: string
    payload: string
    priority: number | null
    channelPriority: number | null
    numAttempts: number
    resultType: "MESSAGE_DEQUEUED"
}

export type MessageDequeueResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

export type MessageDequeueResult =
    | MessageDequeueResultMessageDequeued
    | MessageDequeueResultQueueEmpty

export const messageDequeueQueryResultParse = (result: QueryResult): MessageDequeueResult => {
    if (result.result_code === MessageDequeueResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.result_code === MessageDequeueResultCode.MESSAGE_DEQUEUED) {
        return {
            resultType: "MESSAGE_DEQUEUED",
            id: result.id,
            channelName: result.channel_name,
            payload: result.payload,
            numAttempts: result.num_attempts,
            priority: result.priority,
            channelPriority: result.channel_priority,
            name: result.name,
        }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageDequeue = async (params: {
    databaseClient: DatabaseClient
    schema: string
}): Promise<MessageDequeueResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_dequeue(
        ) AS result
    `).then(res => res.rows[0].result) as QueryResult

    return messageDequeueQueryResultParse(result)
}
