declare module 'csurf' {
    import type { Request, RequestHandler } from 'express'

    interface CookieOptions {
        key?: string
        path?: string
        domain?: string
        secure?: boolean
        httpOnly?: boolean
        sameSite?: boolean | 'lax' | 'strict' | 'none'
    }

    interface CsrfOptions {
        cookie?: CookieOptions
        ignoreMethods?: string[]
        value?: (req: Request) => string
    }

    function csrf(options?: CsrfOptions): RequestHandler

    export = csrf
}
