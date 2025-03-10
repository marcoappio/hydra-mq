import type { DatabaseClient } from '@src/core/database-client'
import { EggTimer } from '@src/core/egg-timer'
import { Semaphore } from '@src/core/semaphore'
import type { HydraEventHandler } from '@src/deployment/event'
import { messageUnlock } from '@src/driver/message-unlock'

export class DaemonUnlocker {

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

            const result = await messageUnlock({
                databaseClient: this.databaseClient,
                schema: this.schema,
            })

            if (result.resultType === 'MESSAGE_NOT_AVAILABLE') {
                this.eggTimer.set(this.timeoutSecs * 1000)
                await this.semaphore.acquire()
                continue
            } else {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: 'MESSAGE_UNLOCKED',
                    messageId: result.messageId,
                    queueId: result.queueId,
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
