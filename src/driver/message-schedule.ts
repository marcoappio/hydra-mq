import type { DatabaseClient } from '@src/core/database-client'
import { sql } from '@src/core/sql'
import { ResultCode } from '@src/driver/result-code'

type DriverResultMessageEnqueued = {
    messageId: string
    queueId: string
    resultType: 'MESSAGE_ENQUEUED'
    scheduleId: string
}

type DriverResultQueueCapacityExceeded = {
    queueId: string
    resultType: 'QUEUE_CAPACITY_EXCEEDED'
    scheduleId: string
}

type DriverResultScheduleNotAvailable = {
    resultType: 'SCHEDULE_NOT_AVAILABLE'
}

type DriverResultScheduleExhausted = {
    queueId: string
    resultType: 'SCHEDULE_EXHAUSTED'
    scheduleId: string
}

type QueryResultMessageEnqueued = {
    o_message_id: string
    o_queue_id: string
    o_result_code: ResultCode.MESSAGE_ENQUEUED
    o_schedule_id: string
}

type QueryResultScheduleEmpty = {
    o_message_id: null
    o_queued_id: string
    o_result_code: ResultCode.SCHEDULE_EXHAUSTED
    o_schedule_id: string
}

type QueryResultQueueCapacityExceeded = {
    o_message_id: null
    o_queued_id: string
    o_result_code: ResultCode.QUEUE_CAPACITY_EXCEEDED
    o_schedule_id: string
}

type QueryResultScheduleNotFound = {
    o_message_id: null
    o_queued_id: null
    o_result_code: ResultCode.SCHEDULE_NOT_AVAILABLE
    o_schedule_id: null
}

type DriverResult =
    | DriverResultMessageEnqueued
    | DriverResultQueueCapacityExceeded
    | DriverResultScheduleNotAvailable
    | DriverResultScheduleExhausted

export type QueryResult =
    | QueryResultMessageEnqueued
    | QueryResultQueueCapacityExceeded
    | QueryResultScheduleNotFound
    | QueryResultScheduleEmpty

export const messageSchedule = async (params: {
    dbClient: DatabaseClient
    schema: string
}): Promise<DriverResult> => {
    const result = await params.dbClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.message_schedule()
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.SCHEDULE_NOT_AVAILABLE) {
        return { resultType: 'SCHEDULE_NOT_AVAILABLE' }
    } else if (result.o_result_code === ResultCode.SCHEDULE_EXHAUSTED) {
        return {
            queueId: result.o_queued_id,
            resultType: 'SCHEDULE_EXHAUSTED',
            scheduleId: result.o_schedule_id,
        }
    } else if (result.o_result_code === ResultCode.MESSAGE_ENQUEUED) {
        return {
            messageId: result.o_message_id,
            queueId: result.o_queue_id,
            resultType: 'MESSAGE_ENQUEUED',
            scheduleId: result.o_schedule_id,
        }
    } else if (result.o_result_code === ResultCode.QUEUE_CAPACITY_EXCEEDED) {
        return {
            queueId: result.o_queued_id,
            resultType: 'QUEUE_CAPACITY_EXCEEDED',
            scheduleId: result.o_schedule_id,
        }
    } else {
        throw new Error('Unexpected result code')
    }
}
