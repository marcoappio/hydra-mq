export type ProcessorFn = (payload: string, metadata: {
    markAsFailed: () => void
    message: {
        id: string
        channelName: string,
        numAttempts: number
    }
}) => Promise<void>
