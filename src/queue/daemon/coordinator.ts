import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { jobProcess } from "@src/binding/job-process"
import { JobType } from "@src/schema/enum/job-type"

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
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_ACCEPTED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_DEDUPLICATED") {
                        this.eventHandler({
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_DEDUPLICATED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_DROPPED") {
                        this.eventHandler({
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_DROPPED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_NOT_FOUND") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_NOT_FOUND"
                        })
                    } else if (result.result.resultType === "MESSAGE_DEPENDENCIES_OUTSTANDING") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_DEPENDENCIES_OUTSTANDING"
                        })
                    } else if (result.result.resultType === "MESSAGE_STATUS_INVALID") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_RELEASED",
                            eventResult: "MESSAGE_STATUS_INVALID",
                        })
                    } else {
                        result.result satisfies never
                        throw new Error("Unexpected result")
                    }
                } else if (result.type === JobType.MESSAGE_UNLOCK) {
                    if (result.result.resultType === "MESSAGE_ACCEPTED") {
                        this.eventHandler({
                            eventType: "MESSAGE_UNLOCKED",
                            eventResult: "MESSAGE_ACCEPTED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_NOT_FOUND") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_UNLOCKED",
                            eventResult: "MESSAGE_NOT_FOUND",
                        })
                    } else if (result.result.resultType === "MESSAGE_STATUS_INVALID") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_UNLOCKED",
                            eventResult: "MESSAGE_STATUS_INVALID",
                        })
                    } else {
                        result.result satisfies never
                        throw new Error("Unexpected result")
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
                            eventType: "MESSAGE_FAILED",
                            eventResult: "MESSAGE_LOCKED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_EXHAUSTED") {
                        this.eventHandler({
                            eventType: "MESSAGE_FAILED",
                            eventResult: "MESSAGE_EXHAUSTED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_NOT_FOUND") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_FAILED",
                            eventResult: "MESSAGE_NOT_FOUND",
                        })
                    } else if (result.result.resultType === "MESSAGE_STATUS_INVALID") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_FAILED",
                            eventResult: "MESSAGE_STATUS_INVALID",
                        })
                    } else {
                        result.result satisfies never
                        throw new Error("Unexpected result")
                    }
                } else if (result.type === JobType.MESSAGE_CREATE) {
                    if (result.result.resultType === "MESSAGE_CREATED") {
                        this.eventHandler({
                            eventType: "MESSAGE_CREATED",
                            messageId: result.result.id
                        })
                    } else {
                        result.result.resultType satisfies never
                        throw new Error("Unexpected result")
                    }
                } else if (result.type === JobType.MESSAGE_DEPENDENCY_UPDATE) {
                    if (result.result.resultType === "MESSAGE_DEPENDENCY_UPDATED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DEPENDENCY_UPDATED",
                            eventResult: "MESSAGE_DEPENDENCY_UPDATED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_NOT_FOUND") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_DEPENDENCY_UPDATED",
                            eventResult: "MESSAGE_NOT_FOUND",
                        })
                    } else if (result.result.resultType === "MESSAGE_STATUS_INVALID") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_DEPENDENCY_UPDATED",
                            eventResult: "MESSAGE_STATUS_INVALID",
                        })
                    } else {
                        result.result satisfies never
                        throw new Error("Unexpected result")
                    }
                } else if (result.type === JobType.MESSAGE_DELETE) {
                    if (result.result.resultType === "MESSAGE_DELETED") {
                        this.eventHandler({
                            eventType: "MESSAGE_DELETED",
                            eventResult: "MESSAGE_DELETED",
                            messageId: result.messageId,
                        })
                    } else if (result.result.resultType === "MESSAGE_NOT_FOUND") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_DELETED",
                            eventResult: "MESSAGE_NOT_FOUND",
                        })
                    } else if (result.result.resultType === "MESSAGE_STATUS_INVALID") {
                        this.eventHandler({
                            messageId: result.messageId,
                            eventType: "MESSAGE_DELETED",
                            eventResult: "MESSAGE_STATUS_INVALID",
                        })
                    } else {
                        result.result satisfies never
                        throw new Error("Unexpected result")
                    }
                } else if (result.type === JobType.CHANNEL_POLICY_CLEAR) {
                    this.eventHandler({
                        eventType: "CHANNEL_POLICY_CLEARED",
                        channelName: result.channelName,
                    })
                } else if (result.type === JobType.CHANNEL_POLICY_SET) {
                    this.eventHandler({
                        eventType: "CHANNEL_POLICY_SET",
                        channelName: result.channelName,
                    })
                } else if (result.type === JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR) {
                    this.eventHandler({
                        eventType: "JOB_MESSAGE_CREATE_SCHEDULE_CLEARED",
                        jobName: result.jobName,
                    })
                } else if (result.type === JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET) {
                    this.eventHandler({
                        eventType: "JOB_MESSAGE_CREATE_SCHEDULE_SET",
                        jobName: result.jobName,
                    })
                } else {
                    result satisfies never
                    throw new Error("Unexpected result")
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
