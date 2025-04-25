import type { MessageDequeueResultDependency } from "@src/binding/message-dequeue"

export type ProcessorFnParams = {
    messageId: string
    channelName: string
    dependencies: MessageDequeueResultDependency[]
    setFail: (params? : { exhaust?: boolean }) => void
    setResults: (result: string) => void
}

export type ProcessorFn = (payload : string, params : ProcessorFnParams) => Promise<void>
