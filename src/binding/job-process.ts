import { messageDependencyUpdateQueryResultParse, type MessageDependencyUpdateQueryResult, type MessageDependencyUpdateResult } from "@src/binding/message-dependency-update"
import { messageCreateQueryResultParse, type MessageCreateQueryResult, type MessageCreateResult } from "@src/binding/message-create"
import { messageFailQueryResultParse, type MessageFailQueryResult, type MessageFailResult } from "@src/binding/message-fail"
import { messageReleaseQueryResultParse, type MessageReleaseQueryResult, type MessageReleaseResult } from "@src/binding/message-release"
import type { MessageSweepManyQueryResult, MessageSweepManyResult } from "@src/binding/message-sweep-many"
import { messageUnlockQueryResultParse, type MessageUnlockQueryResult, type MessageUnlockResult } from "@src/binding/message-unlock"
import type { DatabaseClient } from "@src/core/database-client"
import { refNode, sql } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"
import { JobProcessResultCode } from "@src/schema/job-process"
import { messageDeleteQueryResultParse, type MessageDeleteQueryResult, type MessageDeleteResult } from "@src/binding/message-delete"

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

type QueryResultJobMessageDependencyUpdateProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_DEPENDENCY_UPDATE
    name: string | null
    message_id: string
    result: MessageDependencyUpdateQueryResult
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

type QueryResultJobMessageFailProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_FAIL
    name: string | null
    message_id: string
    result: MessageFailQueryResult
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

type QueryResultJobMessageDeleteProcessed = {
    result_code: JobProcessResultCode.JOB_PROCESSED,
    id: string
    type: JobType.MESSAGE_DELETE
    name: string | null
    message_id: string
    result: MessageDeleteQueryResult
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
    | QueryResultJobMessageDeleteProcessed
    | QueryResultJobMessageFailProcessed
    | QueryResultJobMessageReleaseProcessed
    | QueryResultJobMessageSweepManyProcessed
    | QueryResultJobMessageDependencyUpdateProcessed
    | QueryResultJobMessageUnlockProcessed

type ResultQueueEmpty = {
    resultType: "QUEUE_EMPTY"
}

type ResultJobMessageDependencyUpdateProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_DEPENDENCY_UPDATE
    messageId: string
    result: MessageDependencyUpdateResult
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

type ResultJobMessageFailProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_FAIL
    messageId: string
    result: MessageFailResult
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

type ResultJobMessageDeleteProcessed = {
    id: string
    resultType: "JOB_PROCESSED"
    name: string | null
    type: JobType.MESSAGE_DELETE
    messageId: string
    result: MessageDeleteResult
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
    | ResultJobMessageDependencyUpdateProcessed
    | ResultJobMessageCreateProcessed
    | ResultJobMessageFailProcessed
    | ResultJobMessageReleaseProcessed
    | ResultJobMessageSweepManyProcessed
    | ResultJobMessageUnlockProcessed
    | ResultJobMessageDeleteProcessed
    | ResultJobChannelPolicyClearProcessed
    | ResultJobChannelPolicySetProcessed
    | ResultJobJobScheduleClearMessageCreateProcessed
    | ResultJobJobScheduleSetMessageCreateProcessed

export const jobProcessQueryResultParse = (result: QueryResult): JobProcessResult => {
    if (result.result_code === JobProcessResultCode.QUEUE_EMPTY) {
        return { resultType: "QUEUE_EMPTY" }
    } else if (result.result_code === JobProcessResultCode.JOB_PROCESSED) {
        if (result.type === JobType.MESSAGE_DEPENDENCY_UPDATE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageDependencyUpdateQueryResultParse(result.result)
            }
        } else if (result.type === JobType.MESSAGE_SWEEP_MANY) {
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
        } else if (result.type === JobType.MESSAGE_FAIL) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageFailQueryResultParse(result.result)
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
        } else if (result.type === JobType.MESSAGE_DELETE) {
            return {
                id: result.id,
                resultType: "JOB_PROCESSED",
                name: result.name,
                type: result.type,
                messageId: result.message_id,
                result: messageDeleteQueryResultParse(result.result)
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
