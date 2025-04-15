import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { JobType } from "@src/schema/job"
import { JobProcessResultCode } from "@src/schema/job-process/install"

type QueryResultQueueEmpty = {
    o_id: null
    o_name: null
    o_type: null
    o_result_code: JobProcessResultCode.QUEUE_EMPTY
}

type QueryResultJobProcessed = {
    o_id: string
    o_type: keyof typeof JobType
    o_name: string | null
    o_result_code: JobProcessResultCode.JOB_PROCESSED
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultJobProcessed

type ResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

type ResultJobProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType
}

export type JobProcessResult =
    | ResultQueueEmpty
    | ResultJobProcessed

export const jobProcessParseQueryResult = (result: QueryResult): JobProcessResult => {
    if (result.o_result_code === JobProcessResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.o_result_code === JobProcessResultCode.JOB_PROCESSED) {
        return {
            id: result.o_id,
            resultType: "JOB_PROCESSED",
            name: result.o_name,
            type: JobType[result.o_type],
        }
    } else {
        result satisfies never
        throw new Error("Unexpected result")
    }
}

export const jobProcess = async (params : {
    databaseClient: DatabaseClient
    schema: string
}) => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.job_process()
    `).then(res => res.rows[0]) as QueryResult
    return jobProcessParseQueryResult(result)
}
