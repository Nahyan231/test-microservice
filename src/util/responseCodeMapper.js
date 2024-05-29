import _ from 'lodash';
import wuzzy from 'wuzzy';
import httpContext from 'express-http-context';
const LANGUAGE_HEADER = config.responseCode.setLanguageFromHeader;
/**
 * Filters the response based on the third party error description
 * @param {Object} responseCodeObj response code from cache
 * @param {Object} serverResponse thirdparty response || false
 * @return {Object} response
 */
const filterResponseCode = (responseCodeObj, serverResponse) => {
    try {
        const headers = httpContext.get('reqHeaders');
        const userType = headers && headers['x-channel'] || 'consumer';
        const userLanguage = headers && headers['accept-language'] || 'en';
        const defaultMessage = LANGUAGE_HEADER ? { success: false, responseCode: config.responseCode.default.code, message: config.responseCode.default.message, cta: [] } : { success: false, responseCode: config.responseCode.default.code, message_en: config.responseCode.default.message, message_ur: config.responseCode.default.message, cta: [] };
        logger.debug('Entered function filterResponseCode');
        const isConsumer = userType.indexOf('consumer') > -1 ? true : false;
        const isLanguageUrdu = userLanguage === 'ur' ? true : false;
        let failureReason = serverResponse ? (serverResponse?.Result?.ResultParameters?.ResultParameter?.length > 0 ? serverResponse?.Result?.ResultParameters?.ResultParameter?.filter(item => item.Key == 'FailedReason') : '') : false;
        failureReason = failureReason ? failureReason.length > 0 && failureReason[0].Value : false;
        // logger.debug('responseCodeObj===================', responseCodeObj);
        let message = '';
        let cta = [];
        logger.debug('failureReason ' + failureReason);
        if (responseCodeObj.length > 1) {
            let filteredResponseCode = [];
            if (failureReason) {
                filteredResponseCode = _.chain(responseCodeObj).filter(item => userType.indexOf(item?.isConsumerOrMerchant) > -1 ? true : false).map(item => {
                    ({ message, cta } = filterLanguageNUserType(isConsumer, isLanguageUrdu, message, item, cta));
                    logger.debug('item.thirdPartyErrorDescription ' + item?.thirdPartyErrorDescription);
                    //ranking each reason angainst thirdPartyErrorDescription on levenshtein algo between 0-1. 1 being the closest match
                    return {
                        ranking: wuzzy.levenshtein(item?.thirdPartyErrorDescription, failureReason),
                        thirdPartyErrorDescription: item?.thirdPartyErrorDescription,
                        response: LANGUAGE_HEADER ? { success: item?.success, responseCode: item?.code, message, cta } : { success: item?.success, responseCode: item?.code, message_en: message?.message_en, message_ur: message?.message_ur, cta }
                    };
                }).orderBy(['ranking'], ['desc']).value();
                logger.debug('filteredResponseCode', filteredResponseCode);
                const matchedResponseCodes = filteredResponseCode.filter(item => item?.ranking > 0.60);
                logger.debug('matchedResponseCodes', matchedResponseCodes);
                const finalRespcode = matchedResponseCodes.length > 0 ? matchedResponseCodes[0].response : filteredResponseCode.length > 1 ? filteredResponseCode.find(item =>
                    item?.thirdPartyErrorDescription === 'Default'
                ).response : filteredResponseCode[0]?.response;
                logger.debug(finalRespcode, finalRespcode);
                return finalRespcode ? finalRespcode : defaultMessage;
            } else {
                filteredResponseCode = _.chain(responseCodeObj).filter(item => userType.indexOf(item?.isConsumerOrMerchant) > -1 ? true : false).map(item => {
                    ({ message, cta } = filterLanguageNUserType(isConsumer, isLanguageUrdu, message, item, cta));
                    return {
                        response: LANGUAGE_HEADER ? { success: item?.success, responseCode: item?.code, message, cta } : { success: item?.success, responseCode: item?.code, message_en: message?.message_en, message_ur: message?.message_ur, cta }
                    };
                }).value();
                //logger.debug(finalRespcode, finalRespcode);
                return filteredResponseCode.length > 0 ? filteredResponseCode[0]?.response : defaultMessage;
            }
        } else if (responseCodeObj.length === 1 || !failureReason) {
            ({ message, cta } = filterLanguageNUserType(isConsumer, isLanguageUrdu, message, responseCodeObj[0], cta));
            const response = LANGUAGE_HEADER ? { success: responseCodeObj[0]?.success, responseCode: responseCodeObj[0]?.code, message, cta } : { success: responseCodeObj[0]?.success, responseCode: responseCodeObj[0]?.code, message_en: message?.message_en, message_ur: message?.message_ur, cta };
            logger.debug('response', response);
            return response;
        } else {
            logger.debug('defaultMessage', defaultMessage);
            return defaultMessage;
        }
    } catch (e) {
        throw e;
    }
};
const filterLanguageNUserType = (isConsumer, isLanguageUrdu, message, item, cta) => {
    if (LANGUAGE_HEADER) {
        if (isConsumer && isLanguageUrdu) {
            message = item?.message_consumer_ur;
            cta = [{ key: item?.cta1_consumer_key, label: item?.cta1_consumer_label }, { key: item?.cta2_consumer_key, label: item?.cta2_consumer_label }];
        } else if (isConsumer && !isLanguageUrdu) {
            message = item?.message_consumer_en;
            cta = [{ key: item?.cta1_consumer_key, label: item?.cta1_consumer_label }, { key: item?.cta2_consumer_key, label: item?.cta2_consumer_label }];
        } else if (!isConsumer && isLanguageUrdu) {
            message = item?.message_merchant_ur;
            cta = [{ key: item?.cta1_merchant_key, label: item?.cta1_merchant_label }, { key: item?.cta2_merchant_key, label: item?.cta2_merchant_label }];
        } else {
            message = item?.message_merchant_en;
            cta = [{ key: item?.cta1_merchant_key, label: item?.cta1_merchant_label }, { key: item?.cta2_merchant_key, label: item?.cta2_merchant_label }];
        }
    } else {
        if (isConsumer) {
            message = { message_en: item?.message_consumer_en, message_ur: item?.message_consumer_ur };
            cta = [{ key: item?.cta1_consumer_key, label: item?.cta1_consumer_label }, { key: item?.cta2_consumer_key, label: item?.cta2_consumer_label }];
        } else {
            message = { message_en: item?.message_merchant_en, message_ur: item?.message_merchant_ur };
            cta = [{ key: item?.cta1_merchant_key, label: item?.cta1_merchant_label }, { key: item?.cta2_merchant_key, label: item?.cta2_merchant_label }];
        }
    }
    return { message, cta };
};
export default filterResponseCode;