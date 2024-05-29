import logger from "../util/logger";

const logType = {
    THIRD_PARTY_REQUEST:'Third Party Request',
    THIRD_PARTY_RESPONSE:'Third Party Response',
    INCOMING_REQUEST:'Incoming Request',
    INCOMING_RESPONSE:'Incoming Response',
    INCOMING_REQUST_HEADERS:'Incoming Request Headers',
    INCOMING_REQUEST_PAYLOAD:'Incoming Request Payload',
    OUTGOING_RESPONSE_HEADERS:'Outgoing Response Headers',
    OUTGOING_RESPONSE_PAYLOAD:'Outgoing Response Payload',
    INFO:'info',
    ERROR:'error',
    DEBUG:'debug',
    WARN:'warn'
};


function log(logLevel,functionName,payload,event,className){
    switch (logLevel) {
        case logType.INFO:
            // logger.info({ 
            //     event: event, 
            //     functionName: functionName, 
            //     data: payload
            // })
            logger.log(logType.INFO,{
                message:event,
                className:className,
                functionName:functionName,
                payload:payload
            });
            break;

        case logType.DEBUG:
            if (process.env.NODE_ENV === 'development') {
                logger.log(logType.DEBUG,{
                    message:event,
                    logLevel:logType.DEBUG,
                    className:className,
                    functionName:functionName,
                    //message:message,
                    payload:payload
                });
        }
            break;

        case logType.WARN:
            logger.log(logType.WARN,{
                message:event,
                logLevel:logType.WARN,
                className:className,
                functionName:functionName,
                //message:message,
                payload:payload
            });
            break;
            
        case logType.ERROR:
            logger.log(logType.ERROR,{
                message:event,
                logLevel:logType.ERROR,
                className:className,
                functionName:functionName,
                //message:message,
                payload:payload
            });
            break;   
    
        default:
            break;
    }  
}

export { log, logType };