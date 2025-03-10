import { QueueConfigNamespace } from '@src/deployment/queue/config'
import { QueueMessageNamespace } from '@src/deployment/queue/message'
import { Schedule } from '@src/deployment/queue/schedule'

export class Queue {

    private readonly schema: string
    private readonly queueId: string
    readonly config: QueueConfigNamespace
    readonly message: QueueMessageNamespace

    constructor(params: {
        queueId: string
        schema: string
    }) {
        this.schema = params.schema
        this.queueId = params.queueId
        this.config = new QueueConfigNamespace({
            queueId: this.queueId,
            schema: this.schema,
        })
        this.message = new QueueMessageNamespace({
            queueId: this.queueId,
            schema: this.schema,
        })
    }

    schedule(scheduleId: string) {
        return new Schedule({
            queueId: this.queueId,
            scheduleId: scheduleId,
            schema: this.schema,
        })
    }

}
