import { HTTP_STATUS } from './constants';

const successResponse = (response, successParameters) => {

    const { data = {}, status = "", message_en = "Request completed successfully", message_ur = "", responseCode = "" } = successParameters;
    const httpStatus = status ? status : HTTP_STATUS.OK;

    const successPayload = {
        success: true,
        data: data
    };

    if (responseCode) successPayload.responseCode = responseCode;
    if (message_en) successPayload.message_en = message_en;
    if (message_ur) successPayload.message_ur = message_ur;

    return response.status(httpStatus).send(successPayload);
};

const errorResponse = (res, errorParameters = {}) => {

    const { data = {}, status = "", message_en = "Something went wrong please try again !", message_ur = "", responseCode = "" } = errorParameters;
    const httpStatus = status ? status : HTTP_STATUS.INTERNAL_SERVER_ERROR;

    const errorPayload = {
        success: false,
        data: data
    }

    if (responseCode) errorPayload.responseCode = responseCode;
    if (message_ur) errorPayload.message_ur = message_ur;
    errorPayload.message_en = message_en;

    return res.status(httpStatus).send(errorPayload);
};

const printError = (error, functionName) => {

    logger.error({
        event: '*************** Exited function with error ***************',
        functionName: functionName,
        error: {
            message: error && error.message ? error.message : "",
            error: error && error.error ? error.error : "",
            stack: error && error.stack ? error.stack : ""
        }
    });

}

const printLog = (event, functionName, data = {}) => {

    logger.info({
        event: `*************** ${event} ***************`,
        functionName: functionName,
        data: data ? {
            ...data
        } : ''
    });

}

module.exports = {
    successResponse,
    errorResponse,
    printError,
    printLog
};