import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/queue/daemon/event"
import { jobProcess } from "@src/schema/job-process/binding"

export class DaemonCoordinator {

    private readonly eventHandler: HydraEventHandler
    private readonly databaseClient: DatabaseClient
    private readonly schema: string
    private readonly timeoutSecs: number
    private readonly eggTimer: EggTimer
    private readonly semaphore: Semaphore
    private readonly promise: Promise<void>
    private readonly daemonId: string | null

    private shouldStop: boolean

    constructor(params: {
        daemonId: string | null
        databaseClient: DatabaseClient
        eventHandler: HydraEventHandler
        schema: string
        timeoutSecs: number

    }) {
        this.daemonId = params.daemonId
        this.schema = params.schema
        this.eventHandler = params.eventHandler
        this.timeoutSecs = params.timeoutSecs
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
                this.eggTimer.set(this.timeoutSecs * 1000)
                await this.semaphore.acquire()
                continue
            } else if (result.resultType === "JOB_MESSAGE_ENQUEUE_PROCESSED") {
                if (result.jobResult.resultType === "MESSAGE_ENQUEUED") {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        eventType: "MESSAGE_ENQUEUED",
                        messageId: result.jobResult.messageId,
                        jobId: result.id,
                    })
                } else {
                    throw new Error(`Unexpected job result: ${result.jobResult.resultType}`)
                }
            } else if (result.resultType === "JOB_MESSAGE_RELEASE_PROCESSED") {
                if (result.jobResult.resultType === "MESSAGE_RELEASED") {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        eventType: "MESSAGE_RELEASED",
                        messageId: result.messageId,
                        jobId: result.id,
                    })
                } else {
                    throw new Error(`Unexpected job result: ${result.jobResult.resultType}`)
                }
            } else if (result.resultType === "JOB_MESSAGE_UNLOCK_PROCESSED") {
                if (result.jobResult.resultType === "MESSAGE_UNLOCKED") {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        eventType: "MESSAGE_UNLOCKED",
                        messageId: result.messageId,
                        jobId: result.id,
                    })
                } else {
                    throw new Error(`Unexpected job result: ${result.jobResult.resultType}`)
                }
            } else if (result.resultType === "JOB_MESSAGE_DEPENDENCY_RESOLVE_PROCESSED") {
                if (result.jobResult.resultType === "MESSAGE_DEPENDENCY_RESOLVED") {
                    this.eventHandler({
                        daemonId: this.daemonId,
                        eventType: "MESSAGE_DEPENDENCY_RESOLVED",
                        messageId: result.messageId,
                        jobId: result.id,
                    })
                } else {
                    throw new Error(`Unexpected job result: ${result.jobResult.resultType}`)
                }
            } else {
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
