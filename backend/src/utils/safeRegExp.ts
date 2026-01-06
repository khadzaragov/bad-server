import escapeRegExp from './escapeRegExp'

export class SafeRegExpError extends Error {}

export type SafeRegExpOptions = {
    maxLength?: number
    timeout?: number
    alreadyEscaped?: boolean
}

export default function createSafeRegExp(
    pattern: string,
    flags = 'i',
    options: SafeRegExpOptions = {}
): RegExp {
    const maxLength = options.maxLength ?? 50
    if (pattern.length > maxLength) {
        throw new SafeRegExpError('Search query is too long')
    }

    const source = options.alreadyEscaped
        ? pattern
        : escapeRegExp(pattern)

    let regex: RegExp
    try {
        regex = new RegExp(source, flags)
    } catch {
        throw new SafeRegExpError('Invalid search query')
    }

    const timeout = options.timeout ?? 0
    if (timeout <= 0) {
        return regex
    }

    return new Proxy(regex, {
        get(target, prop) {
            if (prop === 'test' || prop === 'exec') {
                return (...args: unknown[]) => {
                    const startedAt = Date.now()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const result = (target as any)[prop](...args)
                    if (Date.now() - startedAt > timeout) {
                        throw new SafeRegExpError('RegExp timeout')
                    }
                    return result
                }
            }
            return Reflect.get(target, prop)
        },
    }) as RegExp
}
