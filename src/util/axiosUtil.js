import axios from 'axios';
import httpContext from 'express-http-context';
const LOCAL_PORT_NUMBER = process.env.LOCAL_PORT_NUMBER || 3000;
import logger from './logger';
import {logType} from '../model/logType';

const axiosInterceptor = () => {
    axios.interceptors.request.use(req => {

      req.metadata = { 
        startTime: new Date(),
        callingURL:req.url?req.url:req.baseURL
      };
        
        const logObj = httpContext.get('logObj') || null;
        const requestObj=httpContext.get('requestObj') || null;

        //logger.log({level:'info',msisdn:requestObj.msisdn,requestID:requestObj.requestID,URL:requestObj.originalUrl,headers:req.}); 
        if(requestObj){
          logger.log({
            message:logType.THIRD_PARTY_REQUEST,
            level:'info',
            //showDetails:true, 
            msisdn:requestObj.msisdn,
            requestID:requestObj.requestID,
            URL:requestObj.originalUrl,
            callingURL:req.url?req.url:req.baseURL,
            axiosMethod:req.method,
            payload:req.data
          }); 
        }
        //logger.debug({ url: req.url, method: req.method });
        const localPort = Number(LOCAL_PORT_NUMBER);
        if (logObj && logObj.requestID && req.url.indexOf(localPort) !== -1) {
            req.headers['x-requestid'] = logObj.requestID;
        }
        return req;
    });

    axios.interceptors.response.use((response) => {
        // do something with the response data
        const endTime = new Date();
        const startTime = response.config.metadata.startTime;
        const turnaroundTime = endTime - startTime;
        const callingURL = response.config.metadata.callingURL;
        
        //const logObj = httpContext.get('logObj') || null;
        const requestObj=httpContext.get('requestObj') || null;

        function truncateLongData(data) {
          const newData = {};
          
          for (let key in data) {
            if (typeof data[key] === 'object') {
              newData[key] = truncateLongData(data[key]); 
            } else if (typeof data[key] === 'string' && data[key].length > 1000) {
              newData[key] = data[key].substring(0, 1000); 
            } else {
              newData[key] = data[key];
            }
          }
        
          return newData;
        }

        const logdata = truncateLongData(response.data);


        //logger.log({level:'info',msisdn:requestObj.msisdn,requestID:requestObj.requestID,URL:requestObj.originalUrl,headers:req.}); 
        if (requestObj) {
        logger.log({
          message:logType.THIRD_PARTY_RESPONSE,
          level:'info',
          msisdn:requestObj.msisdn,
          requestID:requestObj.requestID,
          URL:requestObj.originalUrl,
          axiosURL:response.url,
          payload:logdata,
          responseTime:turnaroundTime,
          callingURL:callingURL,
          outgoingResponseCode:response.status
        }); 
        }
        return response;
      }, error => {
        const endTime = new Date();
        const startTime = error.config.metadata.startTime;
        const turnaroundTime = endTime - startTime;
        const callingURL = error.config.metadata.callingURL;

        const requestObj = httpContext.get('requestObj') || null;
        if (requestObj) {
          logger.log({
            message:logType.THIRD_PARTY_RESPONSE,
            level:'info',
            msisdn:requestObj.msisdn,
            requestID:requestObj.requestID,
            URL:requestObj.originalUrl,
            axiosURL:error.response?.config?.url,
            payload:error.response?.data,
            responseTime:turnaroundTime,
            callingURL:callingURL
          });
        }
        // handle the response error
        return Promise.reject(error);
      });

};


export default axiosInterceptor;