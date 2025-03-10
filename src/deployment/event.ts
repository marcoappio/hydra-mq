export type HydraEventMessageDequeued = {
    daemonId: string | null
    eventType: 'MESSAGE_DEQUEUED'
    messageId: string
    queueId: string
}

export type HydraEventMessageProcessed = {
    daemonId: string | null
    eventType: 'MESSAGE_PROCESSED'
    messageId: string
    queueId: string
}

export type HydraEventMessageExpired = {
    daemonId: string | null
    error: any
    eventType: 'MESSAGE_EXPIRED'
    messageId: string
    queueId: string
}

export type HydraEventMessageLocked = {
    daemonId: string | null
    error: any
    eventType: 'MESSAGE_LOCKED'
    messageId: string
    queueId: string
}

export type HydraEventMessageCleaned = {
    daemonId: string | null
    eventType: 'MESSAGE_CLEANED'
    messageId: string
    queueId: string
}

export type HydraEventMessageScheduled = {
    daemonId: string | null
    eventType: 'MESSAGE_SCHEDULED'
    messageId: string
    queueId: string
    scheduleId: string
}

export type HydraEventMessageUnlocked = {
    daemonId: string | null
    eventType: 'MESSAGE_UNLOCKED'
    messageId: string
    queueId: string
}

export type HydraEvent =
    | HydraEventMessageDequeued
    | HydraEventMessageProcessed
    | HydraEventMessageExpired
    | HydraEventMessageLocked
    | HydraEventMessageCleaned
    | HydraEventMessageScheduled
    | HydraEventMessageUnlocked

export type HydraEventHandler = (event: HydraEvent) => void
