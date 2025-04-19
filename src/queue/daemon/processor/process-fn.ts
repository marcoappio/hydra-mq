export type ProcessorFnMetadata = {
    setFail: (params? : {
        exhaust? : boolean
    }) => void

    message: {
        id: string
        channelName: string
    }
}
export type ProcessorFn = (payload: string, metadata: ProcessorFnMetadata) => Promise<void>
