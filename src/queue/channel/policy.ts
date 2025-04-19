import type { DatabaseClient } from "@src/core/database-client"
import { channelPolicyClear } from "@src/binding/channel-policy-clear"
import { channelPolicySet } from "@src/binding/channel-policy-set"

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
        maxSize: number | null
    }) {
        return channelPolicySet({
            databaseClient: params.databaseClient,
            maxConcurrency: params.maxConcurrency,
            maxSize: params.maxSize,
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
