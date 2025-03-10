import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type QueryResultMessageNotFound = {
    o_action: null
    o_message_id: null
    o_queue_id: null
    o_result_code: ResultCode.MESSAGE_NOT_AVAILABLE
}

type QueryResultMessageCleaned = {
    o_action: ResultCode.MESSAGE_LOCKED | ResultCode.MESSAGE_FINALIZED
    o_message_id: string
    o_queue_id: string
    o_result_code: ResultCode.MESSAGE_CLEANED
}

type DriverResultMessageCleaned = {
    action: 'MESSAGE_LOCKED' | 'MESSAGE_FINALIZED'
    messageId: string
    queueId: string
    resultType: 'MESSAGE_CLEANED'
}

type DriverResultMessageNotAvailable = {
    resultType: 'MESSAGE_NOT_AVAILABLE'
}

type DriverResult =
    | DriverResultMessageCleaned
    | DriverResultMessageNotAvailable

type QueryResult =
    | QueryResultMessageNotFound
    | QueryResultMessageCleaned

export const messageClean = async (params: {
    dbClient: DatabaseClient
    schema: string
}): Promise<DriverResult> => {
    const result = await params.dbClient.query(sql.build`
        SELECT * FROM ${sql.ref(params.schema)}.message_clean()
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.MESSAGE_NOT_AVAILABLE) {
        return { resultType: 'MESSAGE_NOT_AVAILABLE' }
    } else if (result.o_result_code === ResultCode.MESSAGE_CLEANED) {
        return {
            action: result.o_action === ResultCode.MESSAGE_LOCKED
                ? 'MESSAGE_LOCKED'
                : 'MESSAGE_FINALIZED',
            messageId: result.o_message_id,
            queueId: result.o_queue_id,
            resultType: 'MESSAGE_CLEANED',
        }
    } else {
        throw new Error('Unexpected result code')
    }

}
