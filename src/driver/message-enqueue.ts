import type { DatabaseClient } from "@src/core/database-client"
import { sql } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"

type DriverResult =
    | { resultType: "QUEUE_CAPACITY_EXCEEDED" }
    | { messageId: string, resultType: "MESSAGE_ENQUEUED" | "MESSAGE_UPDATED" }

type QueryResult =
    | { o_message_id: null, o_result_code: ResultCode.QUEUE_CAPACITY_EXCEEDED }
    | { o_message_id: string, o_result_code: ResultCode.MESSAGE_ENQUEUED | ResultCode.MESSAGE_UPDATED }

export const messageEnqueue = async (params: {
    databaseClient: DatabaseClient
    deduplicationId: string | null
    numAttempts: number
    payload: string
    priority: number | null
    queueId: string
    schema: string
    staleSecs: number
    timeoutSecs: number
}): Promise<DriverResult> => {
    const result = await params.databaseClient.query(sql.build `
        SELECT * FROM ${sql.ref(params.schema)}.message_enqueue(
            ${sql.value(params.queueId)},
            ${sql.value(params.payload)},
            ${sql.value(params.priority)},
            ${sql.value(params.timeoutSecs)},
            ${sql.value(params.staleSecs)},
            ${sql.value(params.numAttempts)},
            ${sql.value(params.deduplicationId)}
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
