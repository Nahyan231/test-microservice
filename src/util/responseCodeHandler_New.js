import cache from './cache';
import axios from 'axios';
import logger from './logger';
import _ from 'lodash';
import filterResponseCode from './responseCodeMapper';
const localCache = require('../util/cache_local')
const RESPCODE_SERVICE_URL = process.env.MASTER_DATA_API_GET_RESPCODE_NEW_URL || config.externalServices.masterDataAPI.responseCodeURL_New;

class ResponseCodeHandler_New {
    constructor() {}


    async getErrorResponseCode(error)
    {
        let response = {
            success: false,
            responseCode: config.responseCode.default.code,
            message_en: config.responseCode.default.message,
            message_ur: config.responseCode.default.message,
            data: {}
        };

        if(process.env.PRODUCTION_LOG_LEVEL=== 'debug')
        {
            response.exception=error.message;
            response.stack=error.stack;
        }
        //logger.debug("Outgoing Response " + JSON.stringify(response)); 
        return response;
    }


    /**
     * 
     * 
     * @param {String} code
     * Required
     * Usecase Error/Success Code
     * @param {Array} data 
     * Data that needs to be part of response
     */
    async getResponseCode(code, serverResponse, data) {
        logger.debug(code);

        let responseCodeObj;

        //Default Response message in case no ResponseCode
        let response = {
            success: false,
            responseCode: config.responseCode.default.code,
            message: config.responseCode.default.message,
            cta: [],
            data: [],
        };
        if (!code || _.isEmpty(code)) {
           // logger.debug("Outgoing Response " + JSON.stringify(response)); 
        return response;
        }
        if(serverResponse && process.env.PRODUCTION_LOG_LEVEL=== 'debug')
        {
            response.thirdPartyResponse= serverResponse;
        }

        try {
            //Get Response Code Object From Cache
            logger.debug({ event: 'Entered function', functionName: 'getResponseCode in ResponseCodeHandler_New' });
            // logger.debug(config.cache_New.responseCodeCache);
            let cacheresponseObj =  localCache.get(code);
            //await cache.getValue(code, config.cache_New.responseCodeCache);
            // logger.debug(cacheresponseObj);
            if (!cacheresponseObj) { //If not found in cache get Response Code from Master Data Microservice
                logger.debug("Getting response code from Master Data Microservice");
                const url = `${RESPCODE_SERVICE_URL}?key=${code}`;
                let axiosResp = await axios.get(url);
                if (axiosResp && axiosResp.status == 200) {
                    let resp = axiosResp.data;
                    if (resp && resp.success) {
                        responseCodeObj = _.chain(resp.data).filter(item => item.key === code).value();
                        if (responseCodeObj.length > 0) {
                            localCache.set(code, responseCodeObj)
                            logger.debug(" Printing the object");
                        } else {
                            logger.debug(" Unable to get response code from the MongoDB");
                        }
                    } else {
                        logger.debug(" Unable to get response code from the MongoDB");
                    }
                }
            }
            if (cacheresponseObj) {
                responseCodeObj = cacheresponseObj;
                // logger.debug(responseCodeObj);
            }
            logger.debug('responseCodeObj', responseCodeObj);
            response = filterResponseCode(responseCodeObj, serverResponse);
            logger.debug('response', response);

            if (data) {
                response.data = data;
            } else {
                response.data = {};
            }

        } catch (err) {
           throw new Error(" Error getting response code "+err);
        }

        logger.info("Outgoing Response " + JSON.stringify(response)); 
        return response;
    }


}
export default new ResponseCodeHandler_New();
