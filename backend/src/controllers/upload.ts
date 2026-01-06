import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'fs/promises'
import sharp from 'sharp'
import BadRequestError from '../errors/bad-request-error'

const MIN_FILE_SIZE_BYTES = 2 * 1024
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'gif'])

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
            metadata = await sharp(req.file.path).metadata()
        } catch (error) {
            await safeUnlink(req.file.path)
            return next(new BadRequestError('Invalid image file'))
        }

        if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
            await safeUnlink(req.file.path)
            return next(new BadRequestError('Unsupported image format'))
        }

        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file?.filename}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
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
