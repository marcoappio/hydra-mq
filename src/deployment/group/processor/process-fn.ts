export type ProcessorFn = (payload: string, metadata: {
    markAsFailed: () => void
    messageId: string
    queueId: string
}) => Promise<void>
