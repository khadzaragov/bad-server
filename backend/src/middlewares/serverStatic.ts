import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
  const basePath = path.resolve(baseDir)

  return (req: Request, res: Response, next: NextFunction) => {
    // Определяем полный путь к запрашиваемому файлу
    const requestedPath = path.resolve(baseDir, `.${req.path}`)

    if (!requestedPath.startsWith(basePath + path.sep)) {
      return res.status(403).send('Forbidden')
    }
    // Проверяем, существует ли файл
    fs.access(requestedPath, fs.constants.F_OK, (accessError) => {
      if (accessError) {
        // Файл не существует — отдаём дальше мидлварам
        return next()
      }
      // Файл существует, отправляем его клиенту
      return res.sendFile(requestedPath, (sendError) => {
        if (sendError) {
          next(sendError)
        }
      })
    })
  }
}
