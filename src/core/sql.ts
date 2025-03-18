type ValueType =
    | number
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
    value: string
}

export type SqlRawNode = {
    type: "RAW"
    value: string
}

type SqlNode =
    | SqlValueNode
    | SqlArrayNode
    | SqlRefNode
    | SqlRawNode

const escapeValue = (val: ValueType): string => {
    if (val === null) {
        return "NULL"
    }

    if (typeof val === "number") {
        return val.toString()
    }

    if (typeof val === "boolean") {
        return val ? "TRUE" : "FALSE"
    }

    const escapedStr = val.replace(/'/g, "''")
    return `'${escapedStr}'`
}

const escapeRef = (ident: string): string => {
    const escapedRef = ident.replace(/"/g, "\"\"")
    return `"${escapedRef}"`
}

const escapeArray = (arr: ValueType[]): string => `ARRAY[${arr.map(escapeValue).join(", ")}]`

const value = (val: ValueType): SqlValueNode => ({ type: "VALUE", value: val })

const ref = (ident: string): SqlRefNode => ({ type: "REF", value: ident })

const array = (arr: ValueType[]): SqlArrayNode => ({ type: "ARRAY", value: arr })

const raw = (val: string): SqlRawNode => ({ type: "RAW", value: val })

const build = (fragments: TemplateStringsArray, ...nodes: SqlNode[]): string => {
    const zipped: string[] = []
    for (let ix = 0; ix < fragments.length; ix++) {
        zipped.push(fragments[ix])
        if (ix < nodes.length) {
            const node = nodes[ix]
            switch (node.type) {
            case "VALUE": zipped.push(escapeValue(node.value)); break
            case "REF": zipped.push(escapeRef(node.value)); break
            case "ARRAY": zipped.push(escapeArray(node.value)); break
            case "RAW": zipped.push(node.value); break
            }
        }
    }
    return zipped.join("")
}

// Bundle public API
export const sql = {
    array,
    build,
    raw,
    ref,
    value,
}
