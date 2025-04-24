import type { DatabaseClient } from "@src/core/database-client"
import { arrayNode, refNode, sql, valueNode } from "@src/core/sql"
import { MessageCreateResultCode } from "@src/schema/message-create"

export type MessageCreateResult =
    | { id: string, resultType: "MESSAGE_CREATED" }

export type MessageCreateQueryResult =
    | { id: string, result_code: MessageCreateResultCode.MESSAGE_CREATED }

export const messageCreateQueryResultParse = (result : MessageCreateQueryResult): MessageCreateResult => {
    if (result.result_code === MessageCreateResultCode.MESSAGE_CREATED) {
        return {
            id: result.id,
            resultType: "MESSAGE_CREATED"
        }
    } else {
        result.result_code satisfies never
        throw new Error("Unexpected result")
    }
}

export const messageCreate = async (params: {
    databaseClient: DatabaseClient
    schema: string
    name: string | null
    channelName: string | null
    payload: string
    priority: number | null
    channelPriority: number | null
    numAttempts: number
    maxProcessingMs: number
    lockMs: number
    lockMsFactor: number
    delayMs: number,
    deleteMs: number,
    dependsOn: string[],
}): Promise<MessageCreateResult> => {
    const result = await params.databaseClient.query(sql `
        SELECT * FROM ${refNode(params.schema)}.message_create(
            ${valueNode(params.name)},
            ${valueNode(params.channelName)},
            ${valueNode(params.payload)},
            ${valueNode(params.priority)},
            ${valueNode(params.channelPriority)},
            ${valueNode(params.numAttempts)},
            ${valueNode(params.maxProcessingMs)},
            ${valueNode(params.lockMs)},
            ${valueNode(params.lockMsFactor)},
            ${valueNode(params.delayMs)},
            ${valueNode(params.deleteMs)},
            ${arrayNode(params.dependsOn)}::UUID[]
        ) AS result
    `).then(res => res.rows[0].result) as MessageCreateQueryResult

    return messageCreateQueryResultParse(result)
}
