import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageCreateResultCode {
    MESSAGE_CREATED
}

export const messageCreateInstall = (params: {
    schema: SqlRefNode,
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_create(
                p_name TEXT,
                p_channel_name TEXT,
                p_payload TEXT,
                p_priority INTEGER,
                p_channel_priority INTEGER,
                p_max_processing_ms INTEGER,
                p_delay_ms INTEGER
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_channel_name TEXT;
            BEGIN
                v_now := NOW();
                v_channel_name := COALESCE(p_channel_name, GEN_RANDOM_UUID()::TEXT);

                INSERT INTO ${params.schema}.message (
                    name,
                    channel_name,
                    payload,
                    priority,
                    channel_priority,
                    max_processing_ms,
                    status,
                    is_processed
                ) VALUES (
                    p_name,
                    v_channel_name,
                    p_payload,
                    p_priority,
                    p_channel_priority,
                    p_max_processing_ms,
                    ${valueNode(MessageStatus.CREATED)},
                    ${valueNode(false)}
                ) RETURNING id
                INTO v_message;

                PERFORM ${params.schema}.job_message_release(
                    v_message.id,
                    v_now + p_delay_ms * INTERVAL '1 MILLISECOND'
                );

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageCreateResultCode.MESSAGE_CREATED)}, 
                    'id', v_message.id
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
