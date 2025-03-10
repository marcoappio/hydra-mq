import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type DriverResult =
    | { resultType: 'QUEUE_CAPACITY_EXCEEDED' }
    | { messageId: string, resultType: 'MESSAGE_ADDED' }

type QueryResult =
    | { o_message_id: null, o_result_code: ResultCode.QUEUE_CAPACITY_EXCEEDED }
    | { o_message_id: string, o_result_code: ResultCode.MESSAGE_ENQUEUED }

export const messageEnqueue = async (params: {
    dbClient: DatabaseClient
    numAttempts: number
    payload: string
    priority: number | null
    queueId: string
    schema: string
    staleSecs: number
    timeoutSecs: number
}): Promise<DriverResult> => {
    const result = await params.dbClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.message_enqueue(
            ${sql.value(params.queueId)},
            ${sql.value(params.payload)},
            ${sql.value(params.priority)},
            ${sql.value(params.timeoutSecs)},
            ${sql.value(params.staleSecs)},
            ${sql.value(params.numAttempts)}
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.QUEUE_CAPACITY_EXCEEDED) {
        return { resultType: 'QUEUE_CAPACITY_EXCEEDED' }
    } else if (result.o_result_code === ResultCode.MESSAGE_ENQUEUED) {
        return { messageId: result.o_message_id, resultType: 'MESSAGE_ADDED' }
    } else {
        throw new Error('Unexpected result code')
    }
}
