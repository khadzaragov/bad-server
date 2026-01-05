declare module 'csurf' {
    import { RequestHandler } from 'express'

    interface CsrfOptions {
        cookie?: {
            key?: string
            path?: string
            domain?: string
            secure?: boolean
            httpOnly?: boolean
            sameSite?: boolean | 'lax' | 'strict' | 'none'
        }
        ignoreMethods?: string[]
    }

    function csrf(options?: CsrfOptions): RequestHandler

    export = csrf
}
