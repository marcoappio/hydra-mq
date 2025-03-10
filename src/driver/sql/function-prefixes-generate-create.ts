import { type SqlRefNode, sql } from '@src/core/sql'

export const functionPrefixesGenerateCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE FUNCTION ${params.schema}.prefixes_generate(
            p_value TEXT
        )
        RETURNS TEXT[] AS $$
        DECLARE
            v_parts TEXT[];
            v_result TEXT[] := ARRAY[''];  -- Initialize with empty string
            v_current_prefix TEXT;
        BEGIN
            v_parts := STRING_TO_ARRAY(p_value, '.');
            v_current_prefix := v_parts[1];
            v_result := ARRAY_APPEND(v_result, v_current_prefix);
            
            FOR i IN 2..array_length(v_parts, 1) LOOP
                v_current_prefix := v_current_prefix || '.' || v_parts[i];
                v_result := ARRAY_APPEND(v_result, v_current_prefix);
            END LOOP;
            
            RETURN v_result;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
