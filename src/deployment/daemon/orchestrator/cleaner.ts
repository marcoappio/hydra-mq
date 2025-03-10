import type { DatabaseClient } from '@src/core/database-client'
import { EggTimer } from '@src/core/egg-timer'
import { Semaphore } from '@src/core/semaphore'
import type { HydraEventHandler } from '@src/deployment/event'
import { messageClean } from '@src/driver/message-clean'

export class DaemonCleaner {

    private readonly eventHandler: HydraEventHandler
    private readonly dbClient: DatabaseClient
    private readonly schema: string
    private readonly timeoutSecs: number
    private readonly eggTimer: EggTimer
    private readonly semaphore: Semaphore
    private readonly promise: Promise<void>
    private readonly daemonId: string | null

    private shouldStop: boolean

    constructor(params: {
        daemonId: string | null
        dbClient: DatabaseClient
        eventHandler: HydraEventHandler
        schema: string
        timeoutSecs: number

    }) {
        this.daemonId = params.daemonId
        this.schema = params.schema
        this.eventHandler = params.eventHandler
        this.timeoutSecs = params.timeoutSecs
        this.dbClient = params.dbClient
        this.semaphore = new Semaphore(0)
        this.eggTimer = new EggTimer(() => this.semaphore.release())
        this.shouldStop = false
        this.promise = this.run()
    }

    private async run() {
        while (!this.shouldStop) {

            const result = await messageClean({
                dbClient: this.dbClient,
                schema: this.schema,
            })

            if (result.resultType === 'MESSAGE_NOT_AVAILABLE') {
                this.eggTimer.set(this.timeoutSecs * 1000)
                await this.semaphore.acquire()
                continue
            } else {
                this.eventHandler({
                    daemonId: this.daemonId,
                    eventType: 'MESSAGE_CLEANED',
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
