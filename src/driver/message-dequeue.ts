import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type DriverResultMessageDequeued = {
    messageId: string
    numAttempts: number
    payload: string
    queueId: string
    resultType: 'MESSAGE_DEQUEUED'
}

type DriverResultMessageNotAvailable = {
    resultType: 'MESSAGE_NOT_AVAILABLE'
}

type QueryResultMessageNotFound = {
    o_message_id: null
    o_num_attempts: null
    o_payload: null
    o_queue_id: null
    o_result_code: ResultCode.MESSAGE_NOT_AVAILABLE
}

type QueryResultMessageDequeued = {
    o_message_id: string
    o_num_attempts: number
    o_payload: string
    o_queue_id: string
    o_result_code: ResultCode.MESSAGE_DEQUEUED
}

type QueryResult =
    | QueryResultMessageNotFound
    | QueryResultMessageDequeued

type DriverResult =
    | DriverResultMessageDequeued
    | DriverResultMessageNotAvailable

export const messageDequeue = async (params: {
    databaseClient: DatabaseClient
    queuePrefix: string
    schema: string
}): Promise<DriverResult> => {
    const result = await params.databaseClient.query(sql.build`
        SELECT * FROM ${sql.ref(params.schema)}.message_dequeue(
            ${sql.value(params.queuePrefix)}
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.MESSAGE_NOT_AVAILABLE) {
        return { resultType: 'MESSAGE_NOT_AVAILABLE' }
    } else if (result.o_result_code === ResultCode.MESSAGE_DEQUEUED) {
        return {
            messageId: result.o_message_id,
            numAttempts: result.o_num_attempts,
            payload: result.o_payload,
            queueId: result.o_queue_id,
            resultType: 'MESSAGE_DEQUEUED',
        }
    } else {
        throw new Error('Unexpected result code')
    }
}
