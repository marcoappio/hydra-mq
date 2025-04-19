export type HydraEventMessageAccepted = {
    eventType: "MESSAGE_ACCEPTED"
    messageId: string
}

export type HydraEventMessageDropped = {
    eventType: "MESSAGE_DROPPED"
    messageId: string
}

export type HydraEventMessageDeduplicated = {
    eventType: "MESSAGE_DEDUPLICATED"
    messageId: string
}

export type HydraEventMessageLocked = {
    eventType: "MESSAGE_LOCKED"
    messageId: string,
    error?: any
}

export type HydraEventMessageExhausted = {
    eventType: "MESSAGE_EXHAUSTED"
    messageId: string
    error?: any
}

export type HydraEventMessageUnsatisfied = {
    eventType: "MESSAGE_UNSATISFIED"
    messageId: string
}

export type HydraEventMessageSweptMany = {
    eventType: "MESSAGE_SWEPT_MANY"
    messageIds: string[]
}

export type HydraEventMessageDependencyResolved = {
    eventType: "MESSAGE_DEPENDENCY_RESOLVED"
    messageId: string
}

export type HydraEventMessageEnqueued = {
    eventType: "MESSAGE_ENQUEUED"
    messageId: string
}

export type HydraEventMessageDeleted = {
    eventType: "MESSAGE_DELETED"
    messageId: string
}

export type HydraEventMessageCompleted = {
    eventType: "MESSAGE_COMPLETED"
    messageId: string
}

export type HydraEventMessageDequeued = {
    eventType: "MESSAGE_DEQUEUED"
    messageId: string
}

export type HydraEvent =
    | HydraEventMessageDequeued
    | HydraEventMessageCompleted
    | HydraEventMessageAccepted
    | HydraEventMessageDropped
    | HydraEventMessageDeduplicated
    | HydraEventMessageLocked
    | HydraEventMessageExhausted
    | HydraEventMessageUnsatisfied
    | HydraEventMessageSweptMany
    | HydraEventMessageEnqueued
    | HydraEventMessageDeleted
    | HydraEventMessageDependencyResolved


export type HydraEventHandler = (event: HydraEvent) => void
