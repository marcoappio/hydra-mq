import { type SqlRefNode, sql } from "@src/core/sql"

export enum MessageStatus {
    CREATED,
    ACCEPTED,
    DROPPED,
    DEDUPLICATED,
    UNSATISFIED,
    PROCESSING,
    LOCKED,
    EXHAUSTED,
    COMPLETED,
    FINALIZED
}

export const messageInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.message (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            name TEXT,
            channel_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER NULL,
            channel_priority INTEGER NULL,
            num_attempts INTEGER NOT NULL,
            max_processing_ms REAL NOT NULL,
            delay_ms REAL NOT NULL,
            lock_ms REAL NOT NULL,
            lock_ms_factor REAL NOT NULL,
            status INTEGER NOT NULL,
            is_processed BOOLEAN NOT NULL,
            num_dependencies INTEGER NOT NULL,
            num_dependencies_failed INTEGER NOT NULL,
            dependency_failure_cascade BOOLEAN NOT NULL,
            sweep_after TIMESTAMP,
            created_at TIMESTAMP,
            accepted_at TIMESTAMP,
            PRIMARY KEY (id)
        );
    `
]
