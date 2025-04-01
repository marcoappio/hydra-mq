import { type SqlRefNode, sql, valueNode } from "@src/core/sql"

export enum MessageDeleteResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_DELETED
}

export const messageDeleteInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_delete(
                p_id UUID,
                p_is_success BOOLEAN
            )
            RETURNS TABLE (
                o_result_code INT
            ) AS $$
            DECLARE
                v_message RECORD;
                v_message_dependency RECORD;
            BEGIN
                FOR v_message_dependency IN
                    DELETE FROM ${params.schema}.message_dependency 
                    WHERE parent_message_id = p_id
                    RETURNING child_message_id
                LOOP
                    PERFORM ${params.schema}.job_message_dependency_resolve_enqueue(
                        v_message_dependency.child_message_id,
                        p_is_success
                    );
                END LOOP;

                DELETE FROM ${params.schema}.message
                WHERE id = p_id
                RETURNING 1
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT ${valueNode(MessageDeleteResultCode.MESSAGE_NOT_FOUND)};
                ELSE
                    RETURN QUERY SELECT ${valueNode(MessageDeleteResultCode.MESSAGE_DELETED)};
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
