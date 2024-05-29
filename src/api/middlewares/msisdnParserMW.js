import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * * Validates and converts number to 92xxxxxxxxxx format
 * @param keys {bodyKeys:['msisdn', 'msisdn1'],paramKeys:['msisdn', 'msisdn1']}
 * @return next() next function in chain or throw error
 * 
 */

const msisdnParserMW = (keys) => {
    try {
        return (req, res, next) => {
            const headerMSISDN = 'X-MSISDN'.toLowerCase();
            if (req.headers && req.headers.hasOwnProperty(headerMSISDN)) {
                req.headers[headerMSISDN] = formatNumber(req.headers[headerMSISDN]);
            }
            if (req.body && keys && keys.bodyKeys) {
                req.body = findKey(req.body, keys.bodyKeys);
            }
            if (req.query && keys && keys.paramKeys) {
                req.query = findKey(req.query, keys.paramKeys);
            }
            if (!req.headers[headerMSISDN] || !req.body || !req.query) {
                throw new Error('Invalid MSISDN in request');
            }
            next();
        };
    } catch (error) {
        logger.error(error);
        throw new Error(error);
    }

};

/**
 * * Return number in international E164 format for Pakistan
 * @param {number} msisdn number from header/body
 * @return number in international format for Pakistan 
 */

const formatNumber = (number) => {
    try {
        const phoneNumber = parsePhoneNumberFromString(number.toString(), 'PK');
        return phoneNumber.isValid() ? phoneNumber.number.substring(1) : false; //converts number to 92xxxxxxxxxx format
    } catch (error) {
        logger.error(error);
    }
};

/**
 * * Return request body with number in international E164 format
 * @param {object, key} request body, key to be formated
 * @return {object} request body with msisdn in E164 format
 */
const findKey = (object, targetKeys) => {
    let msisdnIsValid = true;
    Object.keys(object).map((key) => {
        if (targetKeys.includes(key)) {
            if (formatNumber(object[key])) {
                object[key] = formatNumber(object[key]);
                return object;
            } else {
                msisdnIsValid = false;
                return false;
            }
        }
        if (object[key] && typeof object[key] === 'object' && msisdnIsValid) {
            let value = findKey(object[key], targetKeys);
            return value !== undefined;
        }
    });
    return msisdnIsValid ? object : false;
};

export default msisdnParserMW;