import type { MessageDequeueMessage } from "@src/schema/message-dequeue/binding"

export type HydraEventMessageEnqueued = {
    daemonId: string | null
    eventType: "MESSAGE_ENQUEUED"
    jobId: string
    messageId: string
}

export type HydraEventMessageDeduplicated = {
    daemonId: string | null
    eventType: "MESSAGE_DEDUPLICATED"
    jobId: string
    messageId: string
}

export type HydraEventMessageReleased = {
    daemonId: string | null
    eventType: "MESSAGE_RELEASED"
    jobId: string
    messageId: string
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

export type HydraEventMessageUnlocked = {
    daemonId: string | null
    eventType: "MESSAGE_UNLOCKED"
    jobId: string
    messageId: string
}

export type HydraEventMessageDependencyResolved = {
    daemonId: string | null
    eventType: "MESSAGE_DEPENDENCY_RESOLVED"
    jobId: string
    messageId: string
}

export type HydraEvent =
    | HydraEventMessageEnqueued
    | HydraEventMessageDeduplicated
    | HydraEventMessageReleased
    | HydraEventMessageDequeued
    | HydraEventMessageProcessedSuccess
    | HydraEventMessageProcessedFail
    | HydraEventMessageLocked
    | HydraEventMessageUnlocked
    | HydraEventMessageFinalized
    | HydraEventMessageDependencyResolved
    | HydraEventMessageDependenciesUnmet
    | HydraEventMessageAttemptsExhausted

export type HydraEventHandler = (event: HydraEvent) => void
