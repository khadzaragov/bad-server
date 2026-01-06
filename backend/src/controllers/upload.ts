import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'fs/promises'
import sharp from 'sharp'
import BadRequestError from '../errors/bad-request-error'

const MIN_FILE_SIZE_BYTES = 2 * 1024
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'gif'])
const METADATA_TIMEOUT_MS = 3000
const MIME_TO_FORMAT: Record<string, string> = {
    'image/png': 'png',
    'image/jpg': 'jpeg',
    'image/jpeg': 'jpeg',
    'image/gif': 'gif',
}

class MetadataTimeoutError extends Error {
    constructor() {
        super('Metadata timeout')
    }
}

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
    let timeoutId: NodeJS.Timeout | null = null
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new MetadataTimeoutError())
        }, ms)
    })
    try {
        return await Promise.race([promise, timeout])
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

const safeUnlink = async (filePath: string) => {
    try {
        await fs.unlink(filePath)
    } catch {
        // Ignore missing or already-removed files.
    }
}

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }
    try {
        if (req.file.size < MIN_FILE_SIZE_BYTES) {
            await safeUnlink(req.file.path)
            return next(new BadRequestError('File is too small'))
        }

        let metadata
        try {
            metadata = await withTimeout(
                sharp(req.file.path).metadata(),
                METADATA_TIMEOUT_MS
            )
        } catch (error) {
            if (error instanceof MetadataTimeoutError) {
                const fallbackFormat = MIME_TO_FORMAT[req.file.mimetype]
                metadata = {
                    format: fallbackFormat,
                    size: req.file.size,
                }
            } else {
                await safeUnlink(req.file.path)
                return next(new BadRequestError('Invalid image file'))
            }
        }

        if (!metadata?.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
            await safeUnlink(req.file.path)
            return next(new BadRequestError('Unsupported image format'))
        }

        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file?.filename}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file.originalname,
            metadata: {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: metadata.size ?? req.file.size,
            },
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
