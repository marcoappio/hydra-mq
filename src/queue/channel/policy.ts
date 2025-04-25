import type { DatabaseClient } from "@src/core/database-client"
import { jobJobMessageCreateScheduleClear } from "@src/binding/job-job-message-create-schedule-clear"
import { jobChannelPolicySet } from "@src/binding/job-channel-policy-set"
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
        unsafe? : {
            forceImmediate?: boolean
        }
    }) {
        if (params.unsafe?.forceImmediate) {
            return channelPolicySet({
                databaseClient: params.databaseClient,
                maxConcurrency: params.maxConcurrency,
                maxSize: params.maxSize,
                name: this.channel,
                schema: this.schema,
            })
        }

        return jobChannelPolicySet({
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
        return jobJobMessageCreateScheduleClear({
            databaseClient: params.databaseClient,
            name: this.channel,
            schema: this.schema,
        })
    }

}
