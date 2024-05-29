import crypto from 'crypto';
import logger from '../../../util/logger';
import _ from 'lodash';

const EXTERNAL_API_DATA = process.env.EXTERNAL_API_KEY_DATA || config.externalApiKeyData;

let iv = Buffer.from(EXTERNAL_API_DATA.iv, 'utf8');

class encryptionValidator {
  constructor() {}

  async validateApiKey(apiKeyValue) {
    try {
      const decryptPlainText = this.decryptionByAES(
        apiKeyValue,
        EXTERNAL_API_DATA.key
      );
      if (decryptPlainText == null) {
        logger.error('Fail to decrpyt the value given in x-api-key');
        return false;
      } else if (decryptPlainText !== EXTERNAL_API_DATA.plainText) {
        logger.error('Fail to match plain text with plaintext of api-key');
        return false;
      } else {
        logger.debug('Plain text matched, continue.');
        return true;
      }
    } catch (error) {
      logger.error('Some error occurred in encryptionValidator.validateApiKey() ',error);
      //logger.error(error);
      return null;
    }
  }

  decryptionByAES (data, key) {
    logger.debug('Api Key Decryption By AES called');
    logger.debug(`data: ${data}, key: ${key}, ${iv}`);
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(key, 'utf8'),
        iv
      );
      let decrypted = decipher.update(data, 'base64');
      decrypted = decrypted + decipher.final('utf8');
      logger.debug(decrypted);
      return decrypted;
    } catch (error) {
      logger.error('error in apiKeydecryptionByAES(): ', error);
      return null;
    }
  };


}
export default new encryptionValidator();
