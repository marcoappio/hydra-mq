import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type QueryResultMessageNotFound = {
    o_result_code: ResultCode.MESSAGE_NOT_FOUND
}

type QueryResultMessageLocked = {
    o_result_code: ResultCode.MESSAGE_LOCKED
}

type DriveResultMessageLocked = {
    resultType: 'MESSAGE_LOCKED'
}

type DriverResultMessageNotFound = {
    resultType: 'MESSAGE_NOT_FOUND'
}

type DriverResult =
    | DriveResultMessageLocked
    | DriverResultMessageNotFound

type QueryResult =
    | QueryResultMessageNotFound
    | QueryResultMessageLocked

export const messageLock = async (params: {
    dbClient: DatabaseClient
    messageId: string
    schema: string
}): Promise<DriverResult> => {
    const result = await params.dbClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.message_lock(
            ${sql.value(params.messageId)}
        )
    `).then(res => res.rows[0]) as QueryResult
    if (result.o_result_code === ResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: 'MESSAGE_NOT_FOUND' }
    } else if (result.o_result_code === ResultCode.MESSAGE_LOCKED) {
        return { resultType: 'MESSAGE_LOCKED' }
    } else {
        throw new Error('Unexpected result code')
    }
}
