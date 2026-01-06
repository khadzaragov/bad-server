import { Request, Express } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import multer, { FileFilterCallback } from 'multer'
import path from 'path'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const allowedMimeTypes = [
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
]

// Файлы, которые будут приниматься
const allowedExtByMime: Record<string, string> = {
    'image/png': '.png',
    'image/jpg': '.jpg',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
}

function getUploadDir(): string {
    const relativeDir = process.env.UPLOAD_PATH_TEMP
        ? path.join('public', process.env.UPLOAD_PATH_TEMP)
        : 'public'

    return path.resolve(__dirname, '..', relativeDir)
}

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        try {
            const dir = getUploadDir()
            fs.mkdirSync(dir, { recursive: true })
            cb(null, dir)
        } catch (error) {
            cb(error as Error, '')
        }
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const ext = allowedExtByMime[file.mimetype]
        if (!ext) {
            return cb(new Error('Invalid file type'), '')
        }

        // Генерируем безопасное уникальное имя
        const safeName = crypto.randomUUID()
        return cb(null, `${safeName}${ext}`)
    },
})

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, false)
    }

    return cb(null, true)
}

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 9 * 1024 * 1024,
        files: 1,
    },
})
