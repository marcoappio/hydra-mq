import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql, valueNode } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"

type DriverResultQueueCapacityExceeded = {
    resultType: "QUEUE_CAPACITY_EXCEEDED"
}

type DriverResultMessageEnqueued = {
    messageId: string
    resultType: "MESSAGE_ENQUEUED"
}

type DriverResultMessageUpdated = {
    messageId: string
    resultType: "MESSAGE_UPDATED"
}

type QueryResultQueueCapacityExceeded = {
    o_message_id: null
    o_result_code: ResultCode.QUEUE_CAPACITY_EXCEEDED
}

type QueryResultMessageEnqueued = {
    o_message_id: string
    o_result_code: ResultCode.MESSAGE_ENQUEUED
}

type QueryResultMessageUpdated = {
    o_message_id: string
    o_result_code: ResultCode.MESSAGE_UPDATED
}

export type DriverResult =
    | DriverResultQueueCapacityExceeded
    | DriverResultMessageEnqueued
    | DriverResultMessageUpdated

type QueryResult =
    | QueryResultQueueCapacityExceeded
    | QueryResultMessageEnqueued
    | QueryResultMessageUpdated

export const messageEnqueue = async (params: {
    databaseClient: DatabaseClient
    deduplicationId: string | null
    numAttempts: number
    payload: string
    priority: number | null
    queueId: string
    groupId: string
    schema: string
    staleSecs: number
    timeoutSecs: number
}): Promise<DriverResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_enqueue(
            ${valueNode(params.groupId)},
            ${valueNode(params.queueId)},
            ${valueNode(params.payload)},
            ${valueNode(params.priority)},
            ${valueNode(params.timeoutSecs)},
            ${valueNode(params.staleSecs)},
            ${valueNode(params.numAttempts)},
            ${valueNode(params.deduplicationId)}
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.QUEUE_CAPACITY_EXCEEDED) {
        return { resultType: "QUEUE_CAPACITY_EXCEEDED" }
    } else if (result.o_result_code === ResultCode.MESSAGE_ENQUEUED) {
        return { messageId: result.o_message_id, resultType: "MESSAGE_ENQUEUED" }
    } else if (result.o_result_code === ResultCode.MESSAGE_UPDATED) {
        return { messageId: result.o_message_id, resultType: "MESSAGE_UPDATED" }
    } else {
        throw new Error("Unexpected result code")
    }
}
