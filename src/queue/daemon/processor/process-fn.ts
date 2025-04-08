export type ProcessorFnMetadata = {
    setFail: (params : {
        cancelRetries? : boolean
    }) => void

    message: {
        id: string
        channelName: string
        numAttempts: number
    }
}
export type ProcessorFn = (payload: string, metadata: ProcessorFnMetadata) => Promise<void>
