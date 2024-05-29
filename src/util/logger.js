import httpContext from 'express-http-context';
import { createLogger, format, transports } from 'winston';
import stringify from 'json-stringify-safe';
import moment from 'moment';
import 'moment-timezone';
const { combine, timestamp, label, printf } = format;
const PRODUCTION_LOG_LEVEL = process.env.PRODUCTION_LOG_LEVEL || 'debug';
const MASKING_KEYS = process.env.MASKING_KEYS || "password, pin, mpin";
const timezoned = () => {
    return moment().tz("Asia/Karachi").format('DD-MMM-YYYY HH:mm:ss.sss');
}

const customFormat = printf((info) => {
    const reqLogingData = {
        'microservice':'QR Payment Microservice'
    }
    const logObj = httpContext.get('logObj') || reqLogingData || null;
    const infoCopy = Object.assign({},info, logObj);
    let log;
    if (process.env.NODE_ENV === 'development') {
        //log = `[${infoCopy.level}] ${infoCopy.timestamp} ${stringify(infoCopy, null, '...')}`;
        log = `${stringify(infoCopy,null,0)}`;
    } else {
        //if object contains sensitive property ( i.e. key value matches pin, mpin, password, CVV , credit card etc etc , NADRA, CNIC , Mother's name ), **** 
        //if (info.showDetails) {
            log = `${stringify(infoCopy,null,0)}`;    
        // } else {
        //     //log = `[${infoCopy.level}] ${infoCopy.timestamp} ${infoCopy.msisdn} ${infoCopy.requestID} ${stringify(infoCopy.message)}`
        //     log = `${infoCopy.msisdn} ${infoCopy.requestID} ${stringify(infoCopy.message)}`
        // }
        
        log = maskInput(log);
    }
    if (info instanceof Error) {
        log = `${stringify(info,null,0)}`;
    }
    return log;
});

const maskInput = (strLog) => {
    let sensitiveKeys = MASKING_KEYS ? MASKING_KEYS.split(/[\s,]+/) : [];
    for (let key of sensitiveKeys) {
        let keyToFind = `"${key}":`;
        let regex = new RegExp(`${keyToFind}"[^"]+"`, 'gmi');
        strLog = strLog.replace(regex, `${keyToFind}"*****"`);
    }
    return strLog;
}

const logger = createLogger({
    format: combine(
        //label({ label: 'Payment&Transaction_MS' }),
        timestamp({ format: timezoned }),
        //timestamp({ format: 'DD-MMM-YYYY HH:mm:ss.sss' }),
        customFormat,
    ),
    transports: [
        // new winston.transports.File(config.winston.file),
        new transports.Console({
            level: PRODUCTION_LOG_LEVEL,
            handleExceptions: true,
        }),
    ],
    exitOnError: false, // do not exit on handled exceptions
});
export default logger;
