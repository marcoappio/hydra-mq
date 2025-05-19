
export type ProcessorFnParams = {
    message: {
        id: string
        name: string
        channelName: string
        numAttempts: number
        payload: string
        priority: number | null
        channelPriority: number | null
    },
    isStopped: () => boolean
    setFail: () => void
    setRetry: (params? : { lockMs?: number }) => void
}

export type ProcessorFn = (params : ProcessorFnParams) => Promise<void>
