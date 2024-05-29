const logRequestTime = (req, res, next) => {
    req.requestTime = Date.now();
    next();
}


export default {
    logRequestTime
}