import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"
import { MessageDequeueResultCode } from "@src/schema/message-dequeue"

type QueryResultDependencyMissing = {
    status: null
    result: null
    id: string
}

type QueryResultDependencyCompleted = {
    status: MessageStatus.COMPLETED
    result: string | null
    id: string
}

type QueryResultDependencyDropped = {
    status: MessageStatus.DROPPED
    result: null
    id: string
}

type QueryResultDependencyDeduplicated = {
    status: MessageStatus.DEDUPLICATED
    result: null
    id: string
}

type QueryResultDependencyExhausted = {
    status: MessageStatus.EXHAUSTED
    result: null
    id: string
}

type QueryResultDependency =
    | QueryResultDependencyMissing
    | QueryResultDependencyCompleted
    | QueryResultDependencyDropped
    | QueryResultDependencyDeduplicated
    | QueryResultDependencyExhausted

type QueryResultQueueEmpty = {
    result_code: MessageDequeueResultCode.QUEUE_EMPTY
}

type QueryResultMessageDequeued = {
    id: string
    channel_name: string
    payload: string
    result_code: MessageDequeueResultCode.MESSAGE_DEQUEUED
    dependencies: QueryResultDependency[]
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultMessageDequeued

export type MessageDequeueResultDependencyMissing = {
    isSuccess: false
    id: string
    dependencyType: "MISSING"
}


export type MessageDequeueResultDependencyCompleted = {
    isSuccess: true
    dependencyType: "COMPLETED"
    id: string
    data: string | null
}

export type MessageDequeueResultDependencyDropped = {
    isSuccess: false
    dependencyType: "DROPPED"
    id: string
}

export type MessageDequeueResultDependencyDeduplicated = {
    isSuccess: false
    dependencyType: "DEDUPLICATED"
    id: string
}

export type MessageDequeueResultDependencyExhausted = {
    isSuccess: false
    dependencyType: "EXHAUSTED"
    id: string
}

export type MessageDequeueResultDependency =
    | MessageDequeueResultDependencyMissing
    | MessageDequeueResultDependencyCompleted
    | MessageDequeueResultDependencyDropped
    | MessageDequeueResultDependencyDeduplicated
    | MessageDequeueResultDependencyExhausted

export type MessageDequeueResultMessageDequeued = {
    id: string
    channelName: string
    payload: string
    dependencies: MessageDequeueResultDependency[]
    resultType: "MESSAGE_DEQUEUED"
}

export type MessageDequeueResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

export type MessageDequeueResult =
    | MessageDequeueResultMessageDequeued
    | MessageDequeueResultQueueEmpty

const queryResultDependencyParse = (
    result: QueryResultDependency
): MessageDequeueResultDependency => {
    if (result.status === null) {
        return {
            id: result.id,
            isSuccess: false,
            dependencyType: "MISSING"
        }
    } else if (result.status === MessageStatus.COMPLETED) {
        return {
            dependencyType: "COMPLETED",
            isSuccess: true,
            id: result.id,
            data: result.result
        }
    } else if (result.status === MessageStatus.DROPPED) {
        return {
            dependencyType: "DROPPED",
            isSuccess: false,
            id: result.id,
        }
    } else if (result.status === MessageStatus.EXHAUSTED) {
        return {
            dependencyType: "EXHAUSTED",
            isSuccess: false,
            id: result.id,
        }
    } else if (result.status === MessageStatus.DEDUPLICATED) {
        return {
            dependencyType: "DEDUPLICATED",
            isSuccess: false,
            id: result.id,
        }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageDequeueQueryResultParse = (result: QueryResult): MessageDequeueResult => {
    if (result.result_code === MessageDequeueResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.result_code === MessageDequeueResultCode.MESSAGE_DEQUEUED) {
        return {
            resultType: "MESSAGE_DEQUEUED",
            id: result.id,
            channelName: result.channel_name,
            payload: result.payload,
            dependencies: result.dependencies.map(dep => queryResultDependencyParse(dep))
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
