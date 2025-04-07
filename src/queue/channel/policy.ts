import type { DatabaseClient } from "@src/core/database-client"
import { channelPolicyClear } from "@src/schema/channel-config-clear/binding"
import { channelPolicySet } from "@src/schema/channel-policy-set/binding"

export class ChannelPolicyModule {

    private readonly schema: string
    private readonly channel: string

    constructor(params: {
        channel: string
        schema: string
    }) {
        this.schema = params.schema
        this.channel = params.channel
    }

    async set(params: {
        databaseClient: DatabaseClient
        maxConcurrency: number | null
    }) {
        return channelPolicySet({
            databaseClient: params.databaseClient,
            maxConcurrency: params.maxConcurrency,
            name: this.channel,
            schema: this.schema,
        })
    }

    async clear(params: {
        databaseClient: DatabaseClient
    }) {
        return channelPolicyClear({
            databaseClient: params.databaseClient,
            name: this.channel,
            schema: this.schema,
        })
    }

}
