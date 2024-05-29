import logger from './logger';
import axios from 'axios';

const CACHE_URL = process.env.CACHE_URL || config.cache.url;
const CACHE_AUTH_HEADER = process.env.CACHE_AUTH_HEADER || 'Basic YWRtaW46cGFzcw==';
const ENABLE_CACHE_AUTH = process.env.ENABLE_CACHE_AUTH || 'false'; // for local dev, set this to true in .env file
class CacheRest {

    constructor() {
      let headers = {};
      if (ENABLE_CACHE_AUTH == 'true') {
        headers = {
          'Authorization': CACHE_AUTH_HEADER
        }
      }
      this.axiosRequest = axios.create({
        baseURL: CACHE_URL,
        headers
      });
    }

    async putValue(key, value, cacheName) {
        try {

            const url = `${CACHE_URL}/${cacheName}/${key}`;
            const headers = {
                'Content-Type': "text/plain"
            };

            let flag = await axios
            .post(url, value, { headers })
            .then(function (response) {
              logger.debug('************ Successs ********************');
              logger.debug('response.status', response.status);
              logger.debug(response.data);
              if (response.status == 200 || response.status == 204) {
                return true
              } else {
                return false;
              }
            })
            .catch(function (error) {
              logger.debug(error.message);
              return null;
            });
          
            return flag;
            
        } catch (e) {
            logger.debug('Unable to put value in cache' + e);
            return null;
        }
    }

    async getValue(key, cacheName) {
        try {
            
            const url = `${CACHE_URL}/${cacheName}/${key}`;
            
            let axiosResponse = await axios
            .get(url)
            .then(function (response) {
              
              logger.debug('************ Successs ********************');
              logger.debug('response.status', response.status);
              logger.debug(response.data);
              
              if (response.status === 200) {
                return response.data;
              } else {
                return null;
              }
            })
            .catch(function (error) {
              logger.debug(error.message);
              return null;
            });
          
            return axiosResponse;

        } catch (e) {
            logger.debug('Unable to get value from cache' + e);
            return null;
        }
    }

    async putValue2(key, value, cacheName) {
      try {
        const url = `${cacheName}/${key}`;
        await this.axiosRequest.put(url, value);
        return true;
      } catch (e) {
        logger.error('Unable to put value in cache', e);
        return false;
      }
    }

    async getValue2(key, cacheName) {
      try {
        const url = `${cacheName}/${key}`;
        const rsp = await this.axiosRequest.get(url);
        return rsp.data;
      } catch (e) {
        logger.debug('Unable to get value from cache ', e);
        return null;
      }
    }

    async putValueWithExpiry(key, value, cacheName, expiryInSeconds) {
      try {
        let headers = {};
        
        if (ENABLE_CACHE_AUTH == 'true') {
          headers = {
            'Authorization': CACHE_AUTH_HEADER, 
            timeToLiveSeconds: expiryInSeconds
          }
        } else {
          headers = {
            timeToLiveSeconds: expiryInSeconds
          }
        }

        let axiosRequest = axios.create({
          baseURL: CACHE_URL,
          headers
        });

        const url = `${cacheName}/${key}`;
        logger.debug('Calling cache Rest API with following Parameters')
        logger.debug('HEADERS => '+ JSON.stringify(headers));
        logger.debug('ExpiryTime => '+ expiryInSeconds);
        logger.debug('baseURL => '+ CACHE_URL);
        logger.debug('KEY => '+ key);
        logger.debug('value => '+  JSON.stringify(value))
        const response = await axiosRequest.put(url, value);
        

        return true;
      } catch (e) {
        logger.debug('Unable to put value in cache with expiry', e);
        return false;
      }
    }
    
    async deleteRegistryValue(key, cacheName){
      try {
        const url = `${cacheName}/${key}`;
        await this.axiosRequest.delete(url);
        return true;
      } catch (e) {
        logger.error('Unable to delete value in cache', e);
        return false;
      }
    }

    async deleteIndexingArray(msisdn, cacheName){
      try {
        const url = `${cacheName}/TRX_${msisdn}`;
        await this.axiosRequest.delete(url);
        const url2 = `${cacheName}/TRX_${msisdn}_ACC`;
        await this.axiosRequest.delete(url2);
        return true;
      } catch (e) {
        logger.error('Unable to delete value in cache', e);
        return false;
      }
    }

    async deleteValue(key, cacheName) {
      try {
        const url = `${cacheName}/${key}`;
        await this.axiosRequest.delete(url);
        return true;
      } catch (e) {
        logger.error('Unable to delete value in cache', e);
        return false;
      }
    }

}

export default new CacheRest();
