export type ProcessFnMetadata = {
    setFail: (params : {
        cancelRetries? : boolean
    }) => void

    message: {
        id: string
        channelName: string
        numAttempts: number
    }
}
export type ProcessorFn = (payload: string, metadata: ProcessFnMetadata) => Promise<void>
