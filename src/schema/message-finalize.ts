import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageFinalizeResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_DELETED
}

export const messageFinalizeInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_finalize(
                p_id UUID
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_channel_state RECORD;
                v_message_dependency RECORD;
            BEGIN
                v_now := NOW();

                SELECT 
                    status,
                    channel_name
                FROM ${params.schema}.message
                WHERE id = p_id
                AND status IN (
                    ${valueNode(MessageStatus.DROPPED)},
                    ${valueNode(MessageStatus.DEDUPLICATED)},
                    ${valueNode(MessageStatus.UNSATISFIED)},
                    ${valueNode(MessageStatus.EXHAUSTED)},
                    ${valueNode(MessageStatus.COMPLETED)}
                )
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageFinalizeResultCode.MESSAGE_NOT_FOUND)}
                    );
                END IF;
                

                DELETE FROM ${params.schema}.channel_state
                WHERE name = v_message.channel_name
                AND current_size = 0;

                FOR v_message_dependency IN
                    DELETE FROM ${params.schema}.message_dependency 
                    WHERE parent_message_id = p_id
                    RETURNING child_message_id
                LOOP
                    PERFORM ${params.schema}.job_message_dependency_resolve_enqueue(
                        v_message_dependency.child_message_id,
                        v_message.status = ${valueNode(MessageStatus.COMPLETED)}
                    );
                END LOOP;

                DELETE FROM ${params.schema}.message
                WHERE id = p_id;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageFinalizeResultCode.MESSAGE_DELETED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
