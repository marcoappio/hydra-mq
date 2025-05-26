export type HydraEventMessageReleasedMessageNotFound = {
    eventType: "MESSAGE_RELEASED"
    eventResult: "MESSAGE_NOT_FOUND"
    messageId: string
}

export type HydraEventMessageReleasedMessageStatusInvalid = {
    eventType: "MESSAGE_RELEASED"
    eventResult: "MESSAGE_STATUS_INVALID"
    messageId: string
}

export type HydraEventMessageReleasedMessageAccepted = {
    eventType: "MESSAGE_RELEASED"
    eventResult: "MESSAGE_ACCEPTED"
    messageId: string
}

export type HydraEventMessageReleasedMessageDependenciesOutstanding = {
    eventType: "MESSAGE_RELEASED"
    eventResult: "MESSAGE_DEPENDENCIES_OUTSTANDING"
    messageId: string
}

export type HydraEventMessageReleasedMessageDeduplicated = {
    eventType: "MESSAGE_RELEASED"
    eventResult: "MESSAGE_DEDUPLICATED"
    messageId: string
}

export type HydraEventMessageUnlockedMessageNotFound = {
    eventType: "MESSAGE_UNLOCKED"
    eventResult: "MESSAGE_NOT_FOUND"
    messageId: string
}

export type HydraEventMessageUnlockedMessageStatusInvalid = {
    eventType: "MESSAGE_UNLOCKED"
    eventResult: "MESSAGE_STATUS_INVALID"
    messageId: string
}

export type HydraEventMessageUnlockedMessageAccepted = {
    eventType: "MESSAGE_UNLOCKED"
    eventResult: "MESSAGE_ACCEPTED"
    messageId: string
}

export type HydraEventMessageDeletedMessageStatusInvalid = {
    eventType: "MESSAGE_DELETED"
    eventResult: "MESSAGE_STATUS_INVALID"
    messageId: string
}

export type HydraEventMessageDeletedMessageNotFound = {
    eventType: "MESSAGE_DELETED"
    eventResult: "MESSAGE_NOT_FOUND"
    messageId: string
}

export type HydraEventMessageDeletedMessageDeleted = {
    eventType: "MESSAGE_DELETED"
    eventResult: "MESSAGE_DELETED"
    messageId: string
    error: any
}

export type HydraEventMessageRetryredMessageNotFound = {
    eventType: "MESSAGE_RETRIED"
    eventResult: "MESSAGE_NOT_FOUND"
    messageId: string
}

export type HydraEventMessageRetryredMessageStatusInvalid = {
    eventType: "MESSAGE_RETRIED"
    eventResult: "MESSAGE_STATUS_INVALID"
    messageId: string
}

export type HydraEventMessageRetryredMessageLocked = {
    eventType: "MESSAGE_RETRIED"
    eventResult: "MESSAGE_LOCKED"
    messageId: string
}

export type HydraEventMessageRetryredMessageAccepted = {
    eventType: "MESSAGE_RETRIED"
    eventResult: "MESSAGE_ACCEPTED"
    messageId: string
}

export type HydraEventMessageSweptMany = {
    eventType: "MESSAGE_SWEPT_MANY"
    messageIds: string[]
}

export type HydraEventMessageCreated = {
    eventType: "MESSAGE_CREATED"
    messageId: string
}

export type HydraEventMessageDequeued = {
    eventType: "MESSAGE_DEQUEUED"
    messageId: string
}

export type HydraEventChannelPolicyCleared = {
    eventType: "CHANNEL_POLICY_CLEARED"
    channelName: string
}

export type HydraEventChannelPolicySet = {
    eventType: "CHANNEL_POLICY_SET"
    channelName: string
}

export type HydraEventJobMessageCreateScheduleSet = {
    eventType: "JOB_MESSAGE_CREATE_SCHEDULE_SET"
    jobName: string
}

export type HydraEventJobMessageCreateScheduleCleared = {
    eventType: "JOB_MESSAGE_CREATE_SCHEDULE_CLEARED"
    jobName: string
}

export type HydraEvent =
    | HydraEventChannelPolicyCleared
    | HydraEventChannelPolicySet
    | HydraEventJobMessageCreateScheduleCleared
    | HydraEventJobMessageCreateScheduleSet
    | HydraEventMessageCreated
    | HydraEventMessageDequeued
    | HydraEventMessageDeletedMessageDeleted
    | HydraEventMessageDeletedMessageNotFound
    | HydraEventMessageDeletedMessageStatusInvalid
    | HydraEventMessageRetryredMessageAccepted
    | HydraEventMessageRetryredMessageLocked
    | HydraEventMessageRetryredMessageNotFound
    | HydraEventMessageRetryredMessageStatusInvalid
    | HydraEventMessageReleasedMessageAccepted
    | HydraEventMessageReleasedMessageDeduplicated
    | HydraEventMessageReleasedMessageDependenciesOutstanding
    | HydraEventMessageReleasedMessageNotFound
    | HydraEventMessageReleasedMessageStatusInvalid
    | HydraEventMessageSweptMany
    | HydraEventMessageUnlockedMessageAccepted
    | HydraEventMessageUnlockedMessageNotFound
    | HydraEventMessageUnlockedMessageStatusInvalid


export type HydraEventHandler = (event: HydraEvent) => void
