import type { MessageDequeueResultDependency } from "@src/binding/message-dequeue"

export type ProcessorFn = (payload : string, params : {
    messageId: string
    channelName: string
    dependencies: MessageDequeueResultDependency[]
    setFail: (params? : { exhaust?: boolean }) => void
    setResults: (result: string) => void
}) => Promise<void>
