import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { jobProcess } from "@src/binding/job-process"
import { JobType } from "@src/schema/job"

export class DaemonCoordinator {

    private readonly eventHandler: HydraEventHandler
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly timeoutMs: number
    private readonly eggTimer: EggTimer
    private readonly semaphore: Semaphore
    private readonly promise: Promise<void>

    private shouldStop: boolean

    constructor(params: {
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler
        schema: string
        timeoutMs: number

    }) {
        this.schema = params.schema
        this.eventHandler = params.eventHandler
        this.timeoutMs = params.timeoutMs
        this.databaseClient = params.databaseClient
        this.semaphore = new Semaphore(0)
        this.eggTimer = new EggTimer(() => this.semaphore.release())
        this.shouldStop = false
        this.promise = this.run()
    }

    private async run() {
        while (!this.shouldStop) {

            const result = await jobProcess({
                databaseClient: this.databaseClient,
                schema: this.schema,
            })

            if (result.resultType === "QUEUE_EMPTY") {
                this.eggTimer.set(this.timeoutMs)
                await this.semaphore.acquire()
                continue
            } else if (result.resultType === "JOB_PROCESSED") {
                if (result.type === JobType.MESSAGE_RELEASE) {
                    if (result.result.resultType === "MESSAGE_ACCEPTED") {
                        this.eventHandler({
                            eventType: "MESSAGE_ACCEPTED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_DEDUPLICATED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DEDUPLICATED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_DROPPED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DROPPED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_UNSATISFIED") {
                        this.eventHandler({
                            eventType: "MESSAGE_UNSATISFIED",
                            messageId: result.messageId,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_FINALIZE) {
                    if (result.result.resultType === "MESSAGE_DELETED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DELETED",
                            messageId: result.messageId,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_UNLOCK) {
                    if (result.result.resultType === "MESSAGE_ACCEPTED") {
                        this.eventHandler({
                            eventType: "MESSAGE_ACCEPTED",
                            messageId: result.messageId,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_SWEEP_MANY) {
                    if (result.result.ids.length > 0) {
                        this.eventHandler({
                            eventType: "MESSAGE_SWEPT_MANY",
                            messageIds: result.result.ids,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_FAIL) {
                    if (result.result.resultType === "MESSAGE_LOCKED") {
                        this.eventHandler({
                            eventType: "MESSAGE_LOCKED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_EXHAUSTED") {
                        this.eventHandler({
                            eventType: "MESSAGE_EXHAUSTED",
                            messageId: result.messageId,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_ENQUEUE) {
                    if (result.result.resultType === "MESSAGE_ENQUEUED") {
                        this.eventHandler({
                            eventType: "MESSAGE_ENQUEUED",
                            messageId: result.result.messageId,
                        })
                    }
                } else if (result.type === JobType.MESSAGE_DEPENDENCY_RESOLVE) {
                    if (result.result.resultType === "MESSAGE_DEPENDENCY_RESOLVED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DEPENDENCY_RESOLVED",
                            messageId: result.messageId,
                        })
                    }
                }
            } else {
                result satisfies never
                throw new Error("Unexpected result")
            }
        }
    }

    async stop() {
        this.shouldStop = true
        this.eggTimer.clear()
        this.semaphore.release()
        await this.promise
    }

}
