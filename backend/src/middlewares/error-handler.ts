import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500
    const message =
        statusCode === 500 ? 'На сервере произошла ошибка' : err.message
    console.log(err)

    res.status(statusCode).send({ message })
}

export default errorHandler
