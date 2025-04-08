import { refNode } from "@src/core/sql"
import { QueueChannelModule } from "@src/queue/channel"
import { ChannelMessageModule } from "@src/queue/channel/message"
import { QueueDaemonModule } from "@src/queue/daemon"
import { messageInstall } from "@src/schema/message"
import { channelPolicyInstall } from "@src/schema/channel-policy"
import { channelStateInstall } from "@src/schema/channel-state"
import { jobMessageReleaseParamsInstall } from "@src/schema/job-message-release-params"
import { jobInstall } from "@src/schema/job"
import { messageEnqueueInstall } from "@src/schema/message-enqueue/install"
import { jobMessageReleaseEnqueueInstall } from "@src/schema/job-message-release-enqueue"
import { messageReleaseInstall } from "@src/schema/message-release/install"
import { channelPolicySetInstall } from "@src/schema/channel-policy-set/install"
import { jobMessageDeleteParamsInstall } from "@src/schema/job-message-delete-params"
import { jobMessageUnlockParamsInstall } from "@src/schema/job-message-unlock-params"
import { jobMessageUnlockEnqueueInstall } from "@src/schema/job-message-unlock-enqueue"
import { messageUnlockInstall } from "@src/schema/message-unlock/install"
import { messageFinalizeInstall } from "@src/schema/message-finalize/install"
import { cronNextInstall } from "@src/schema/cron-next/install"
import { messageLockInstall } from "@src/schema/message-lock/install"
import { messageDequeueInstall } from "@src/schema/message-dequeue/install"
import { channelPolicyClearInstall } from "@src/schema/channel-policy-clear/install"
import { jobProcessInstall } from "@src/schema/job-process/install"
import { jobMessageEnqueueScheduleClearInstall } from "@src/schema/job-message-enqueue-schedule-clear/install"
import { jobMessageEnqueueScheduleSetInstall } from "@src/schema/job-message-enqueue-schedule-set/install"
import { messageDependencyInstall } from "@src/schema/message-dependency"
import { messageDependencyResolveInstall } from "@src/schema/message-dependency-resolve/install"
import { jobMessageDependencyResolveParamsInstall } from "@src/schema/job-message-dependency-resolve-params"
import { jobMessageDependencyResolveEnqueueInstall } from "@src/schema/job-message-dependency-resolve-enqueue"
import { jobMessageEnqueueParamsInstall } from "@src/schema/job-message-enqueue-params"

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
        const schema = refNode(this.schema)
        return [
            // Install Tables
            ...messageInstall({ schema }),
            ...messageDependencyInstall({ schema }),
            ...channelPolicyInstall({ schema }),
            ...channelStateInstall({ schema }),
            ...jobInstall({ schema }),
            ...jobMessageReleaseParamsInstall({ schema }),
            ...jobMessageDeleteParamsInstall({ schema }),
            ...jobMessageEnqueueParamsInstall({ schema }),
            ...jobMessageUnlockParamsInstall({ schema }),
            ...jobMessageDependencyResolveParamsInstall({ schema }),

            // Util Functions
            ...cronNextInstall({ schema }),

            // Message functions
            ...messageDequeueInstall({ schema }),
            ...messageDependencyResolveInstall({ schema }),
            ...messageEnqueueInstall({ schema }),
            ...messageFinalizeInstall({ schema }),
            ...messageLockInstall({ schema }),
            ...messageReleaseInstall({ schema }),
            ...messageUnlockInstall({ schema }),

            // Channel functions
            ...channelPolicySetInstall({ schema }),
            ...channelPolicyClearInstall({ schema }),

            // Job functions
            ...jobMessageEnqueueScheduleClearInstall({ schema }),
            ...jobMessageEnqueueScheduleSetInstall({ schema }),
            ...jobMessageReleaseEnqueueInstall({ schema }),
            ...jobMessageDependencyResolveEnqueueInstall({ schema }),
            ...jobMessageUnlockEnqueueInstall({ schema }),
            ...jobProcessInstall({ schema }),
        ]
    }

    channel(channel: string) {
        return new QueueChannelModule({
            channel,
            schema: this.schema,
        })
    }

}
