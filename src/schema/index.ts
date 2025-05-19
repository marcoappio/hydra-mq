import { type SqlRefNode } from "@src/core/sql"
import { channelPolicyInstall } from "@src/schema/table/channel-policy"
import { channelPolicyClearInstall } from "@src/schema/channel-policy-clear"
import { channelPolicySetInstall } from "@src/schema/channel-policy-set"
import { channelStateInstall } from "@src/schema/table/channel-state"
import { cronNextInstall } from "@src/schema/cron-next"
import { jobInstall } from "@src/schema/table/job"
import { jobMessageCreateScheduleClearInstall } from "@src/schema/job-message-create-schedule-clear"
import { jobMessageCreateScheduleSetInstall } from "@src/schema/job-message-create-schedule-set"
import { jobMessageRetryInstall } from "@src/schema/job-message-retry"
import { jobMessageReleaseInstall } from "@src/schema/job-message-release"
import { jobMessageUnlockInstall } from "@src/schema/job-message-unlock"
import { jobProcessInstall } from "@src/schema/job-process"
import { messageInstall } from "@src/schema/table/message"
import { messageDequeueInstall } from "@src/schema/message-dequeue"
import { messageCreateInstall } from "@src/schema/message-create"
import { messageReleaseInstall } from "@src/schema/message-release"
import { messageDeleteInstall } from "@src/schema/message-delete"
import { messageSweepManyInstall } from "@src/schema/message-sweep-many"
import { messageUnlockInstall } from "@src/schema/message-unlock"
import { jobChannelPolicySetInstall } from "@src/schema/job-channel-policy-set"
import { jobChannelPolicyClearInstall } from "@src/schema/job-channel-policy-clear"
import { jobJobMessageCreateScheduleClearInstall } from "@src/schema/job-job-message-create-schedule-clear"
import { jobJobMessageCreateScheduleSetInstall } from "@src/schema/job-job-message-create-schedule-set"
import { messageRetryInstall } from "@src/schema/message-retry"

export const schemaInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        // Tables and their indices
        ...channelPolicyInstall(params),
        ...channelStateInstall(params),
        ...jobInstall(params),
        ...messageInstall(params),

        // Functions
        ...channelPolicyClearInstall(params),
        ...channelPolicySetInstall(params),
        ...cronNextInstall(params),
        ...jobChannelPolicyClearInstall(params),
        ...jobChannelPolicySetInstall(params),
        ...jobJobMessageCreateScheduleClearInstall(params),
        ...jobJobMessageCreateScheduleSetInstall(params),
        ...jobMessageCreateScheduleClearInstall(params),
        ...jobMessageCreateScheduleSetInstall(params),
        ...jobMessageRetryInstall(params),
        ...jobMessageReleaseInstall(params),
        ...jobMessageUnlockInstall(params),
        ...jobProcessInstall(params),
        ...messageCreateInstall(params),
        ...messageRetryInstall(params),
        ...messageDeleteInstall(params),
        ...messageDequeueInstall(params),
        ...messageReleaseInstall(params),
        ...messageSweepManyInstall(params),
        ...messageUnlockInstall(params),
    ]

}
