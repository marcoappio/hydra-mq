export interface DatabaseClient {
    query: (sqlQuery: string) => Promise<{
        rows: Array<Record<string, unknown>>
    }>
}
