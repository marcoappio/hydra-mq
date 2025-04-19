import { type SqlRefNode } from "@src/core/sql"
import { channelPolicyInstall } from "@src/schema/channel-policy"
import { channelPolicyClearInstall } from "@src/schema/channel-policy-clear"
import { channelPolicySetInstall } from "@src/schema/channel-policy-set"
import { channelStateInstall } from "@src/schema/channel-state"
import { cronNextInstall } from "@src/schema/cron-next"
import { jobInstall } from "@src/schema/job"
import { jobDequeueIxInstall } from "@src/schema/job-dequeue-ix"
import { jobLookupIxInstall } from "@src/schema/job-lookup-ix"
import { jobMessageDependencyResolveEnqueueInstall } from "@src/schema/job-message-dependency-resolve-enqueue"
import { jobMessageEnqueueScheduleClearInstall } from "@src/schema/job-message-enqueue-schedule-clear"
import { jobMessageEnqueueScheduleSetInstall } from "@src/schema/job-message-enqueue-schedule-set"
import { jobMessageFinalizeEnqueueInstall } from "@src/schema/job-message-finalize-enqueue"
import { jobMessageLockEnqueueInstall } from "@src/schema/job-message-lock-enqueue"
import { jobMessageReleaseEnqueueInstall } from "@src/schema/job-message-release-enqueue"
import { jobMessageUnlockEnqueueInstall } from "@src/schema/job-message-unlock-enqueue"
import { jobProcessInstall } from "@src/schema/job-process"
import { messageInstall } from "@src/schema/message"
import { messageDependencyInstall } from "@src/schema/message-dependency"
import { messageDependencyResolveIxInstall } from "@src/schema/message-dependency-resolve-ix"
import { messageDependencyResolveInstall } from "@src/schema/message-dependency-resolve"
import { messageDequeueInstall } from "@src/schema/message-dequeue"
import { messageEnqueueInstall } from "@src/schema/message-enqueue"
import { messageFailInstall } from "@src/schema/message-fail"
import { messageFinalizeInstall } from "@src/schema/message-finalize"
import { messageDeduplicationIxInstall } from "@src/schema/message-deduplication-ix"
import { messageDequeueIxInstall } from "@src/schema/message-dequeue-ix"
import { messageSweepIxInstall } from "@src/schema/message-sweep-ix"
import { messageReleaseInstall } from "@src/schema/message-release"
import { messageSuccessInstall } from "@src/schema/message-success"
import { messageSweepManyInstall } from "@src/schema/message-sweep-many"
import { messageUnlockInstall } from "@src/schema/message-unlock"
import { channelPolicyLookupIxInstall } from "@src/schema/channel-policy-lookup-ix"
import { channelStateLookupIxInstall } from "@src/schema/channel-state-lookup-ix"
import { channelStateDequeueIxInstall } from "@src/schema/channel-state-dequeue-ix"

export const schemaInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        // Tables
        ...channelPolicyInstall(params),
        ...channelStateInstall(params),
        ...jobInstall(params),
        ...messageDependencyInstall(params),
        ...messageInstall(params),

        // Indices
        ...channelPolicyLookupIxInstall(params),
        ...channelStateDequeueIxInstall(params),
        ...channelStateLookupIxInstall(params),
        ...jobDequeueIxInstall(params),
        ...jobLookupIxInstall(params),
        ...messageDeduplicationIxInstall(params),
        ...messageDependencyResolveIxInstall(params),
        ...messageDequeueIxInstall(params),
        ...messageSweepIxInstall(params),

        // Functions
        ...channelPolicyClearInstall(params),
        ...channelPolicySetInstall(params),
        ...cronNextInstall(params),
        ...jobMessageDependencyResolveEnqueueInstall(params),
        ...jobMessageEnqueueScheduleClearInstall(params),
        ...jobMessageEnqueueScheduleSetInstall(params),
        ...jobMessageFinalizeEnqueueInstall(params),
        ...jobMessageLockEnqueueInstall(params),
        ...jobMessageReleaseEnqueueInstall(params),
        ...jobMessageUnlockEnqueueInstall(params),
        ...jobProcessInstall(params),
        ...messageDependencyResolveInstall(params),
        ...messageDequeueInstall(params),
        ...messageEnqueueInstall(params),
        ...messageFailInstall(params),
        ...messageFinalizeInstall(params),
        ...messageReleaseInstall(params),
        ...messageSuccessInstall(params),
        ...messageSweepManyInstall(params),
        ...messageUnlockInstall(params),
    ]

}
