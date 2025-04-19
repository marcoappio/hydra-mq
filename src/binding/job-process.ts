import { messageDependencyResolveQueryResultParse, type MessageDependencyResolveQueryResult, type MessageDependencyResolveResult } from "@src/binding/message-dependency-resolve"
import { messageEnqueueQueryResultParse, type MessageEnqueueQueryResult, type MessageEnqueueResult } from "@src/binding/message-enqueue"
import { messageFailQueryResultParse, type MessageFailQueryResult, type MessageFailResult } from "@src/binding/message-fail"
import { messageFinalizeQueryResultParse, type MessageFinalizeQueryResult, type MessageFinalizeResult } from "@src/binding/message-finalize"
import { messageReleaseQueryResultParse, type MessageReleaseQueryResult, type MessageReleaseResult } from "@src/binding/message-release"
import type { MessageSweepManyQueryResult, MessageSweepManyResult } from "@src/binding/message-sweep-many"
import { messageUnlockQueryResultParse, type MessageUnlockQueryResult, type MessageUnlockResult } from "@src/binding/message-unlock"
import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { JobType } from "@src/schema/job"
import { JobProcessResultCode } from "@src/schema/job-process"

type QueryResultQueueEmpty = {
    result_code: JobProcessResultCode.QUEUE_EMPTY
}

type QueryResultJobMessageDependencyResolveProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_DEPENDENCY_RESOLVE
    name: string | null
    message_id: string
    result: MessageDependencyResolveQueryResult
}

type QueryResultJobMessageSweepManyProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_SWEEP_MANY
    name: string | null
    result: MessageSweepManyQueryResult
}

type QueryResultJobMessageFinalizeProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_FINALIZE
    name: string | null
    message_id: string
    result: MessageFinalizeQueryResult
}

type QueryResultJobMessageUnlockProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_UNLOCK
    name: string | null
    message_id: string
    result: MessageUnlockQueryResult
}

type QueryResultJobMessageFailProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_FAIL
    name: string | null
    message_id: string
    result: MessageFailQueryResult
}

type QueryResultJobMessageEnqueueProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_ENQUEUE
    name: string | null
    result: MessageEnqueueQueryResult
}

type QueryResultJobMessageReleaseProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_RELEASE
    name: string | null
    message_id: string
    result: MessageReleaseQueryResult
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultJobMessageDependencyResolveProcessed
    | QueryResultJobMessageEnqueueProcessed
    | QueryResultJobMessageFailProcessed
    | QueryResultJobMessageFinalizeProcessed
    | QueryResultJobMessageReleaseProcessed
    | QueryResultJobMessageSweepManyProcessed
    | QueryResultJobMessageUnlockProcessed


type ResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

type ResultJobMessageDependencyResolveProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_DEPENDENCY_RESOLVE
    messageId: string
    result: MessageDependencyResolveResult
}

type ResultJobMessageSweepManyProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_SWEEP_MANY
    result: MessageSweepManyResult
}

type ResultJobMessageFinalizeProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_FINALIZE
    messageId: string
    result: MessageFinalizeResult
}

type ResultJobMessageUnlockProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_UNLOCK
    messageId: string
    result: MessageUnlockResult
}

type ResultJobMessageFailProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_FAIL
    messageId: string
    result: MessageFailResult
}

type ResultJobMessageEnqueueProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_ENQUEUE
    result: MessageEnqueueResult
}

type ResultJobMessageReleaseProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_RELEASE
    messageId: string
    result: MessageReleaseResult
}

export type JobProcessResult =
    | ResultQueueEmpty
    | ResultJobMessageDependencyResolveProcessed
    | ResultJobMessageEnqueueProcessed
    | ResultJobMessageFailProcessed
    | ResultJobMessageFinalizeProcessed
    | ResultJobMessageReleaseProcessed
    | ResultJobMessageSweepManyProcessed
    | ResultJobMessageUnlockProcessed

export const jobProcessQueryResultParse = (result: QueryResult): JobProcessResult => {
    if (result.result_code === JobProcessResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.result_code === JobProcessResultCode.JOB_PROCESSED) {
        if (result.type === JobType.MESSAGE_DEPENDENCY_RESOLVE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageDependencyResolveQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_SWEEP_MANY) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                result: result.result
            }
        } else if (result.type === JobType.MESSAGE_FINALIZE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageFinalizeQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_UNLOCK) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageUnlockQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_FAIL) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageFailQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_ENQUEUE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                result: messageEnqueueQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_RELEASE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageReleaseQueryResultParse(result.result)
            }
        } else {
            result satisfies never
            throw new Error("Unexpected job type")
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
        SELECT * FROM ${refNode(params.schema)}.job_process() AS result
    `).then(res => res.rows[0].result) as QueryResult
    return jobProcessQueryResultParse(result)
}
