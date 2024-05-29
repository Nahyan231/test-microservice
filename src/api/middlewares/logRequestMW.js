import uid from 'gen-uid';
import httpContext from 'express-http-context';
import logger from '../../util/logger';
import {logType} from '../../model/logType';

const logRequestMW = (req, res, next) => {

    try {
        const start = new Date();
        const requestID = req.headers['x-requestid'] || `${uid.token(true)}T${Date.now()}`;
        const msisdn = req.get('X-MSISDN') || 'N/A';
        const { method, originalUrl } = req;
        const urlArray = originalUrl.split('/');
        const usecase = urlArray[urlArray.length-1]+"/"+urlArray[urlArray.length-2];
        const deviceID = req.get('x-device-id') || 'N/A';
        const requestHeaders = {...req.headers };

        httpContext.set('logObj', 
        { requestID,
             msisdn,
            deviceID, 
            method, 
            originalUrl, 
            usecase,
            'microservice':'QR Payment Microservice',
         });
        httpContext.set('reqHeaders', req.headers);

        if (requestHeaders['x-mpin']) {
            requestHeaders['x-mpin'] = '****';
        }
       
       httpContext.set('requestObj',{msisdn,requestID,URL});         

       logger.log({
        message:logType.INCOMING_REQUST_HEADERS,
        level:'info', 
        msisdn:msisdn,
        requestID:requestID,
        URL:originalUrl,
        headers:requestHeaders
    }); 
       if(req.body)    
       logger.log({
        message:logType.INCOMING_REQUEST_PAYLOAD,
        level:'info', 
        msisdn:msisdn,
        requestID:requestID,
        URL:originalUrl,
        payload:req.body
    });  

        //logger.debug(requestHeaders);

         //Also apply some logging for response 
         const cleanup = () => {
            res.removeListener('finish', onFinish);
            res.removeListener('close', onClose);
            res.removeListener('error', onError);
        };
    
        const onClose = () => {
            cleanup();
            logger.warn(`Request ${requestID} was aborted by the client sent`);
        };
        const onError = (err) => {
            cleanup();
            logger.error(`Error is request ${requestID}`);
            logger.error(err);
        };
    
        const onFinish = () => {
            cleanup();
            //const responseBody = Buffer.concat(chunks).toString('utf8');
            const { statusCode, statusMessage } = res;
            logger.log({
                message: logType.OUTGOING_RESPONSE_PAYLOAD, 
                level: 'info', 
                msisdn, 
                responseTime:new Date() - start,
                responseID: requestID, 
                URL: originalUrl, 
                outgoingResponseCode:statusCode, 
                statusMessage 
            });
            //logger.log({ message: `Outgoing response for request ${requestID} on URL ${originalUrl} took ${new Date() - start} ms `, level: 'info' });
            // logger.log({ 
            //     message: logType.OUTGOING_RESPONSE_PAYLOAD, 
            //     level: 'info',
            //     responseTime:new Date() - start

            // });
            //logger.info({ responseID: requestID, statusCode, statusMessage, 'contentLength': `(${res.get('Content-Length')} b sent)`, 'at':`(${new Date()})` });
        };

        res.on('finish', onFinish);
    
        res.on('close', onClose);
    
        res.on('error', onError);

        next();
    } catch (error) {
        logger.error(error);
        res.status(500).send({
            success: false,
            outgoingResponseCode: config.default.code,
            message_en: config.default.code,
            message_ur: config.default.code,
            data: []
        });
    }

};


export default logRequestMW;