import type { DatabaseClient } from "@src/core/database-client"
import { sql } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"

type QueryResultMessageNotFound = {
    o_result_code: ResultCode.MESSAGE_NOT_FOUND
}

type QueryResultMessageFinalized = {
    o_result_code: ResultCode.MESSAGE_FINALIZED
}

type DriverResultMessageFinalized = {
    resultType: "MESSAGE_FINALIZED"
}

type DriverResultMessageNotFound = {
    resultType: "MESSAGE_NOT_FOUND"
}

type QueryResult =
    | QueryResultMessageNotFound
    | QueryResultMessageFinalized

type DriverResult =
    | DriverResultMessageFinalized
    | DriverResultMessageNotFound

export const messageFinalize = async (params: {
    databaseClient: DatabaseClient
    messageId: string
    schema: string
}): Promise<DriverResult> => {
    const result = await params.databaseClient.query(sql.build`
        SELECT * FROM ${sql.ref(params.schema)}.message_finalize(
            ${sql.value(params.messageId)}
        )
    `).then(res => res.rows[0]) as QueryResult

    if (result.o_result_code === ResultCode.MESSAGE_NOT_FOUND) {
        return { resultType: "MESSAGE_NOT_FOUND" }
    } else if (result.o_result_code === ResultCode.MESSAGE_FINALIZED) {
        return { resultType: "MESSAGE_FINALIZED" }
    } else {
        throw new Error("Unexpected result code")
    }
}
