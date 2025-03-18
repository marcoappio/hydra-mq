import type { DaemonProcessorDequeueModule } from "@src/deployment/daemon/processor/dequeue"

export interface DaemonProcessorDirectory {
    getDequeueModule(): DaemonProcessorDequeueModule
}
