import { messageCreateQueryResultParse, type MessageCreateQueryResult, type MessageCreateResult } from "@src/binding/message-create"
import { messageRetryQueryResultParse, type MessageRetryQueryResult, type MessageRetryResult } from "@src/binding/message-retry"
import { messageReleaseQueryResultParse, type MessageReleaseQueryResult, type MessageReleaseResult } from "@src/binding/message-release"
import type { MessageSweepManyQueryResult, MessageSweepManyResult } from "@src/binding/message-sweep-many"
import { messageUnlockQueryResultParse, type MessageUnlockQueryResult, type MessageUnlockResult } from "@src/binding/message-unlock"
import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"
import { JobProcessResultCode } from "@src/schema/job-process"

type QueryResultQueueEmpty = {
    result_code: JobProcessResultCode.QUEUE_EMPTY
}

type QueryResultJobJobMessageCreateScheduleClearProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED
    id: string
    type: JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR
    name: string | null
    job_name: string
}

type QueryResultJobJobMessageCreateScheduleSetProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED
    id: string
    type: JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET
    name: string | null
    job_name: string
}

type QueryResultJobMessageSweepManyProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_SWEEP_MANY
    name: string | null
    result: MessageSweepManyQueryResult
}

type QueryResultJobMessageUnlockProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_UNLOCK
    name: string | null
    message_id: string
    result: MessageUnlockQueryResult
}

type QueryResultJobMessageRetryProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_RETRY
    name: string | null
    message_id: string
    result: MessageRetryQueryResult
}

type QueryResultJobMessageCreateProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_CREATE
    name: string | null
    result: MessageCreateQueryResult
}

type QueryResultJobMessageReleaseProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_RELEASE
    name: string | null
    message_id: string
    result: MessageReleaseQueryResult
}

type QueryResultJobChannelPolicyClearProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.CHANNEL_POLICY_CLEAR
    name: string | null
    channel_name: string
}

type QueryResultJobChannelPolicySetProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.CHANNEL_POLICY_SET
    name: string | null
    channel_name: string
}

type QueryResult =
    | QueryResultQueueEmpty
    | QueryResultJobChannelPolicyClearProcessed
    | QueryResultJobChannelPolicySetProcessed
    | QueryResultJobJobMessageCreateScheduleClearProcessed
    | QueryResultJobJobMessageCreateScheduleSetProcessed
    | QueryResultJobMessageCreateProcessed
    | QueryResultJobMessageRetryProcessed
    | QueryResultJobMessageReleaseProcessed
    | QueryResultJobMessageSweepManyProcessed
    | QueryResultJobMessageUnlockProcessed

type ResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

type ResultJobMessageSweepManyProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_SWEEP_MANY
    result: MessageSweepManyResult
}

type ResultJobMessageUnlockProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_UNLOCK
    messageId: string
    result: MessageUnlockResult
}

type ResultJobMessageRetryProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_RETRY
    messageId: string
    result: MessageRetryResult
}

type ResultJobMessageCreateProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_CREATE
    result: MessageCreateResult
}

type ResultJobMessageReleaseProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_RELEASE
    messageId: string
    result: MessageReleaseResult
}

type ResultJobChannelPolicyClearProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.CHANNEL_POLICY_CLEAR
    channelName: string
}

type ResultJobChannelPolicySetProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.CHANNEL_POLICY_SET
    channelName: string
}

type ResultJobJobScheduleClearMessageCreateProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR
    jobName: string
}

type ResultJobJobScheduleSetMessageCreateProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET
    jobName: string
}

export type JobProcessResult =
    | ResultQueueEmpty
    | ResultJobMessageCreateProcessed
    | ResultJobMessageRetryProcessed
    | ResultJobMessageReleaseProcessed
    | ResultJobMessageSweepManyProcessed
    | ResultJobMessageUnlockProcessed
    | ResultJobChannelPolicyClearProcessed
    | ResultJobChannelPolicySetProcessed
    | ResultJobJobScheduleClearMessageCreateProcessed
    | ResultJobJobScheduleSetMessageCreateProcessed

export const jobProcessQueryResultParse = (result: QueryResult): JobProcessResult => {
    if (result.result_code === JobProcessResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.result_code === JobProcessResultCode.JOB_PROCESSED) {
        if (result.type === JobType.MESSAGE_SWEEP_MANY) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                result: result.result
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
        } else if (result.type === JobType.MESSAGE_RETRY) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageRetryQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_CREATE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                result: messageCreateQueryResultParse(result.result)
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
        } else if (result.type === JobType.CHANNEL_POLICY_CLEAR) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                channelName: result.channel_name
            }
        } else if (result.type === JobType.CHANNEL_POLICY_SET) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                channelName: result.channel_name
            }
        } else if (result.type === JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                jobName: result.job_name
            }
        } else if (result.type === JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                jobName: result.job_name
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
