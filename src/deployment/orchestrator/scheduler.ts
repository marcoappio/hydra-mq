import type { DatabaseClient } from "@src/core/database-client"
import { EggTimer } from "@src/core/egg-timer"
import { Semaphore } from "@src/core/semaphore"
import type { HydraEventHandler } from "@src/deployment/event"
import { messageSchedule } from "@src/driver/message-schedule"

export class DaemonScheduler {

    private readonly eventHandler: HydraEventHandler | null
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
        eventHandler: HydraEventHandler | null
        schema: string
        timeoutSecs: number

    }) {
        this.daemonId = params.daemonId
        this.schema = params.schema
        this.timeoutSecs = params.timeoutSecs
        this.databaseClient = params.databaseClient
        this.semaphore = new Semaphore(0)
        this.eggTimer = new EggTimer(() => this.semaphore.release())
        this.shouldStop = false
        this.promise = this.run()
        this.eventHandler = params.eventHandler
    }

    private async run() {
        while (!this.shouldStop) {
            const result = await messageSchedule({
                databaseClient: this.databaseClient,
                schema: this.schema,
            })

            if (result.resultType === "SCHEDULE_NOT_AVAILABLE") {
                this.eggTimer.set(this.timeoutSecs * 1000)
                await this.semaphore.acquire()
            } else if (result.resultType === "MESSAGE_ENQUEUED" && this.eventHandler) {
                this.eventHandler({
                    daemonId: this.daemonId,
                    groupId: result.groupId,
                    eventType: "MESSAGE_SCHEDULED",
                    messageId: result.messageId,
                    queueId: result.queueId,
                    scheduleId: result.scheduleId,
                })
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
