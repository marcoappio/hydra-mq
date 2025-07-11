type ValueType =
    | number
    | Date
    | string
    | boolean
    | null

export type SqlValueNode = {
    type: "VALUE"
    value: ValueType
}

export type SqlArrayNode = {
    type: "ARRAY"
    value: ValueType[]
}

export type SqlRefNode = {
    type: "REF"
    value: string[]
}

export type SqlRawNode = {
    type: "RAW"
    value: string
}

export type SqlNode =
    | SqlValueNode
    | SqlArrayNode
    | SqlRefNode
    | SqlRawNode

const escapeValue = (val: ValueType): string => {
    if (val === null) {
        return "NULL"
    } else if (typeof val === "number") {
        return val.toString()
    } else if (typeof val === "boolean") {
        return val ? "TRUE" : "FALSE"
    } else if (val instanceof Date) {
        return `'${val.toISOString()}'`
    } else if (typeof val === "string") {
        const escapedStr = val.replace(/'/g, "''")
        return `'${escapedStr}'`
    } else {
        throw new Error(`Unsupported value type: ${typeof val}`)
    }

}

export const valueNode = (val: ValueType): SqlValueNode => ({ type: "VALUE", value: val })

export const refNode = (...idents: string[]): SqlRefNode => ({ type: "REF", value: idents })

export const arrayNode = (arr: ValueType[]): SqlArrayNode => ({ type: "ARRAY", value: arr })

export const rawNode = (val: string): SqlRawNode => ({ type: "RAW", value: val })

export const escapeValueNode = (node: SqlValueNode): string => {
    return escapeValue(node.value)
}

export const escapeRefNode = (node: SqlRefNode): string => {
    return node.value
        .map(x => x.replace(/"/g, "\"\""))
        .map(x => `"${x}"`)
        .join(".")
}

export const escapeArrayNode = (node: SqlArrayNode): string => {
    const elements = node.value.map(escapeValue).join(", ")
    return `ARRAY[${elements}]`
}

export const escapeRawNode = (node: SqlRawNode): string => {
    return node.value
}

export const sql = (fragments: TemplateStringsArray, ...nodes: SqlNode[]): string => {
    const zipped: string[] = []
    for (let ix = 0; ix < fragments.length; ix += 1) {
        zipped.push(fragments[ix])

        if (ix < nodes.length) {
            const node = nodes[ix]
            if (node.type === "VALUE") {
                zipped.push(escapeValueNode(node))
            } else if (node.type === "REF") {
                zipped.push(escapeRefNode(node))
            } else if (node.type === "ARRAY") {
                zipped.push(escapeArrayNode(node))
            } else if (node.type === "RAW") {
                zipped.push(escapeRawNode(node))
            } else {
                throw new Error("Unknown node type")
            }
        }
    }

    return zipped.join("")
}
