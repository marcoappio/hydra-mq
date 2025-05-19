import type { DatabaseClient } from "@src/core/database-client"
import { jobChannelPolicySet } from "@src/binding/job-channel-policy-set"
import { channelPolicySet } from "@src/binding/channel-policy-set"
import { jobChannelPolicyClear } from "@src/binding/job-channel-policy-clear"

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
        maxConcurrency: number
        unsafe? : {
            forceImmediate?: boolean
        }
    }) {
        if (params.unsafe?.forceImmediate) {
            return channelPolicySet({
                databaseClient: params.databaseClient,
                maxConcurrency: params.maxConcurrency,
                name: this.channel,
                schema: this.schema,
            })
        }

        return jobChannelPolicySet({
            databaseClient: params.databaseClient,
            maxConcurrency: params.maxConcurrency,
            name: this.channel,
            schema: this.schema,
        })
    }

    async clear(params: {
        databaseClient: DatabaseClient
    }) {
        return jobChannelPolicyClear({
            databaseClient: params.databaseClient,
            name: this.channel,
            schema: this.schema,
        })
    }

}
