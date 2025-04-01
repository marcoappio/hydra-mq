import { ChannelPolicyModule } from "@src/queue/channel/policy"
import { ChannelMessageModule } from "@src/queue/channel/message"

export class QueueChannelModule {

    private readonly schema: string
    private readonly channel: string

    readonly policy: ChannelPolicyModule
    readonly message: ChannelMessageModule

    constructor(params: {
        channel: string
        schema: string
    }) {
        this.schema = params.schema
        this.channel = params.channel

        this.message = new ChannelMessageModule({
            schema: this.schema,
            channel: this.channel,
        })

        this.policy = new ChannelPolicyModule({
            channel: this.channel,
            schema: this.schema,
        })
    }

}
