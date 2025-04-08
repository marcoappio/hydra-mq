import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { JobType } from "@src/schema/job"
import { JobProcessResultCode } from "@src/schema/job-process/install"
import { messageDependencyResolveParseQueryResult, type MessageDependencyResolveResult } from "@src/schema/message-dependency-resolve/binding"
import type { MessageDependencyResolveResultCode } from "@src/schema/message-dependency-resolve/install"
import { messageEnqueueParseQueryResult, type MessageEnqueueResult } from "@src/schema/message-enqueue/binding"
import { MessageEnqueueResultCode } from "@src/schema/message-enqueue/install"
import { messageReleaseParseQueryResult, type MessageReleaseResult } from "@src/schema/message-release/binding"
import type { MessageReleaseResultCode } from "@src/schema/message-release/install"
import { messageUnlockParseQueryResult, type MessageUnlockResult } from "@src/schema/message-unlock/binding"
import type { MessageUnlockResultCode } from "@src/schema/message-unlock/install"

type QueryResultQueueEmpty = {
    o_id: null
    o_type: null
    o_name: null
    o_result_code: JobProcessResultCode.QUEUE_EMPTY
    o_job_result_code: null
    o_job_message_id: null
}

type QueryResultJobMessageReleaseProcessed = {
    o_id: string
    o_type: JobType.MESSAGE_RELEASE
    o_name: string
    o_result_code: JobProcessResultCode.JOB_PROCESSED
    o_job_result_code: MessageReleaseResultCode
    o_job_message_id: string
}

type QueryResultJobMessageDependencyResolveProcessed = {
    o_id: string
    o_type: JobType.MESSAGE_DEPENDENCY_RESOLVE
    o_name: string
    o_result_code: JobProcessResultCode.JOB_PROCESSED
    o_job_result_code: MessageDependencyResolveResultCode,
    o_job_message_id: string
}

type QueryResultJobMessageUnlockProcessed = {
    o_id: string
    o_type: JobType.MESSAGE_UNLOCK
    o_name: string
    o_result_code: JobProcessResultCode.JOB_PROCESSED
    o_job_result_code: MessageUnlockResultCode,
    o_job_message_id: string
}

type QueryResultJobMessageEnqueueProcessedMessageReturned = {
    o_id: string
    o_type: JobType.MESSAGE_ENQUEUE
    o_name: string
    o_result_code: JobProcessResultCode.JOB_PROCESSED
    o_job_result_code:
        | MessageEnqueueResultCode.MESSAGE_DEDUPLICATED
        | MessageEnqueueResultCode.MESSAGE_ENQUEUED
    o_job_message_id: string
}

type QueryResultJobMessageEnqueueProcessedMessageDependencyNotFound = {
    o_id: string
    o_type: JobType.MESSAGE_ENQUEUE
    o_name: string
    o_result_code: JobProcessResultCode.JOB_PROCESSED
    o_job_result_code: MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND,
    o_job_message_id: null
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultJobMessageDependencyResolveProcessed
    | QueryResultJobMessageReleaseProcessed
    | QueryResultJobMessageUnlockProcessed
    | QueryResultJobMessageEnqueueProcessedMessageReturned
    | QueryResultJobMessageEnqueueProcessedMessageDependencyNotFound

type ResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

type ResultJobMessageReleaseProcessed = {
    id: string
    messageId: string
    resultType: "JOB_MESSAGE_RELEASE_PROCESSED"
    jobResult: MessageReleaseResult
}

type ResultJobMessageDependencyResolveProcessed = {
    id: string
    messageId: string
    resultType: "JOB_MESSAGE_DEPENDENCY_RESOLVE_PROCESSED"
    jobResult: MessageDependencyResolveResult
}

type ResultJobMessageUnlockProcessed = {
    id: string
    messageId: string
    resultType: "JOB_MESSAGE_UNLOCK_PROCESSED"
    jobResult: MessageUnlockResult
}

type ResultJobMessageEnqueueProcessed = {
    id: string
    resultType: "JOB_MESSAGE_ENQUEUE_PROCESSED"
    jobResult: MessageEnqueueResult
}

export type JobProcessResult =
    | ResultQueueEmpty
    | ResultJobMessageReleaseProcessed
    | ResultJobMessageUnlockProcessed
    | ResultJobMessageEnqueueProcessed
    | ResultJobMessageDependencyResolveProcessed

export const jobProcessParseQueryResult = (result: QueryResult): JobProcessResult => {
    if (result.o_result_code === JobProcessResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.o_type === JobType.MESSAGE_ENQUEUE) {
        if (result.o_job_result_code === MessageEnqueueResultCode.MESSAGE_DEPENDENCY_NOT_FOUND) {
            return {
                id: result.o_id,
                resultType: "JOB_MESSAGE_ENQUEUE_PROCESSED",
                jobResult: messageEnqueueParseQueryResult({
                    o_result_code: result.o_job_result_code,
                    o_id: result.o_job_message_id,
                })
            }
        } else {
            return {
                id: result.o_id,
                resultType: "JOB_MESSAGE_ENQUEUE_PROCESSED",
                jobResult: messageEnqueueParseQueryResult({
                    o_result_code: result.o_job_result_code,
                    o_id: result.o_job_message_id,
                })
            }
        }
    } else if (result.o_type === JobType.MESSAGE_RELEASE) {
        return {
            id: result.o_id,
            resultType: "JOB_MESSAGE_RELEASE_PROCESSED",
            messageId: result.o_job_message_id,
            jobResult: messageReleaseParseQueryResult({ o_result_code: result.o_job_result_code }),
        }
    } else if (result.o_type === JobType.MESSAGE_UNLOCK) {
        return {
            id: result.o_id,
            messageId: result.o_job_message_id,
            resultType: "JOB_MESSAGE_UNLOCK_PROCESSED",
            jobResult: messageUnlockParseQueryResult({ o_result_code: result.o_job_result_code }),
        }
    } else if (result.o_type === JobType.MESSAGE_DEPENDENCY_RESOLVE) {
        return {
            id: result.o_id,
            messageId: result.o_job_message_id,
            resultType: "JOB_MESSAGE_DEPENDENCY_RESOLVE_PROCESSED",
            jobResult: messageDependencyResolveParseQueryResult({ o_result_code: result.o_job_result_code }),
        }
    } else {
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
