import { type SqlRefNode, type SqlValueNode, sql } from '@src/core/sql'
import { MessageStatus } from '@src/driver/message-status'

export const queryMessageDequeue = (params: {
    limit: SqlValueNode | SqlRefNode
    queueIdPrefix: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => sql.build `
    SELECT 
        message.id, 
        message.queue_id, 
        message.payload, 
        message.num_attempts, 
        message.timeout_secs
    FROM ${params.schema}.message
    INNER JOIN ${params.schema}.message_queue_prefix
    ON message_queue_prefix.message_id = message.id
    WHERE message_queue_prefix.status = ${sql.value(MessageStatus.READY)}
    AND message_queue_prefix.queue_id_prefix = ${params.queueIdPrefix}
    ORDER BY 
        message_queue_prefix.priority DESC NULLS LAST, 
        message_queue_prefix.created_at ASC
    LIMIT ${params.limit}
`
