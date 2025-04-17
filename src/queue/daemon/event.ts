import type { JobType } from "@src/schema/job"
import type { MessageDequeueMessage } from "@src/schema/message-dequeue/binding"

export type HydraEventMessageEnqueued = {
    daemonId: string | null
    eventType: "MESSAGE_ENQUEUED"
    jobId: string
    messageId: string
}

export type HydraEventJobProcessed = {
    daemonId: string | null
    eventType: "JOB_PROCESSED"
    jobType: keyof typeof JobType
    jobId: string
}

export type HydraEventMessageDequeued = {
    daemonId: string | null
    eventType: "MESSAGE_DEQUEUED"
    message: MessageDequeueMessage
}

export type HydraEventMessageProcessedSuccess = {
    daemonId: string | null
    eventType: "MESSAGE_PROCESSED_SUCCESS"
    messageId: string
}

export type HydraEventMessageProcessedFail = {
    daemonId: string | null
    eventType: "MESSAGE_PROCESSED_FAIL"
    messageId: string
    error: any
}

export type HydraEventMessageDependenciesUnmet = {
    daemonId: string | null
    eventType: "MESSAGE_DEPENDENCIES_UNMET"
    messageId: string
}

export type HydraEventMessageAttemptsExhausted = {
    daemonId: string | null
    eventType: "MESSAGE_ATTEMPTS_EXHAUSTED"
    messageId: string
}

export type HydraEventMessageFinalized = {
    daemonId: string | null
    eventType: "MESSAGE_FINALIZED"
    messageId: string,
    isSuccess: boolean
}

export type HydraEventMessageLocked = {
    daemonId: string | null
    eventType: "MESSAGE_LOCKED"
    messageId: string
}

export type HydraEvent =
    | HydraEventMessageEnqueued
    | HydraEventMessageDequeued
    | HydraEventMessageProcessedSuccess
    | HydraEventMessageProcessedFail
    | HydraEventMessageLocked
    | HydraEventMessageFinalized
    | HydraEventMessageDependenciesUnmet
    | HydraEventMessageAttemptsExhausted
    | HydraEventJobProcessed

export type HydraEventHandler = (event: HydraEvent) => void
