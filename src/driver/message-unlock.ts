import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type DriverResultMessageUnlocked = {
    messageId: string
    queueId: string
    resultType: 'MESSAGE_UNLOCKED'
}

type DriverResultMessageNotAvailable = {
    resultType: 'MESSAGE_NOT_AVAILABLE'
}

type QueryResultMessageNotAvailable = {
    o_message_id: null
    o_queue_id: null
    o_result_code: ResultCode.MESSAGE_NOT_AVAILABLE
}

type QueryResultMessageUnlocked = {
    o_message_id: string
    o_queue_id: string
    o_result_code: ResultCode.MESSAGE_UNLOCKED
}

type DriverResult =
    | DriverResultMessageUnlocked
    | DriverResultMessageNotAvailable

type QueryResult =
    | QueryResultMessageNotAvailable
    | QueryResultMessageUnlocked

export const messageUnlock = async (params: {
    databaseClient: DatabaseClient
    schema: string
}): Promise<DriverResult> => {
    const result = await params.databaseClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.message_unlock()
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.MESSAGE_NOT_AVAILABLE) {
        return { resultType: 'MESSAGE_NOT_AVAILABLE' }
    } else if (result.o_result_code === ResultCode.MESSAGE_UNLOCKED) {
        return {
            messageId: result.o_message_id,
            queueId: result.o_queue_id,
            resultType: 'MESSAGE_UNLOCKED',
        }
    } else {
        throw new Error('Unexpected result code')
    }

}
