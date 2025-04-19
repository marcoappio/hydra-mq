import { refNode } from "@src/core/sql"
import { QueueChannelModule } from "@src/queue/channel"
import { ChannelMessageModule } from "@src/queue/channel/message"
import { QueueDaemonModule } from "@src/queue/daemon"
import { schemaInstall } from "@src/schema"

export class Queue {

    private readonly schema: string

    readonly message : ChannelMessageModule
    readonly daemon : QueueDaemonModule

    constructor(params: {
        schema: string
    }) {
        this.schema = params.schema

        this.daemon = new QueueDaemonModule({
            schema: this.schema
        })

        this.message = new ChannelMessageModule({
            schema: this.schema,
            channel: null,
        })
    }

    installation() {
        return schemaInstall({
            schema: refNode(this.schema),
        })
    }

    channel(channel: string) {
        return new QueueChannelModule({
            channel,
            schema: this.schema,
        })
    }

}
