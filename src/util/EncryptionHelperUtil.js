import crypto from 'crypto';

let ENCRYPTION_KEYS = process.env.THIRD_PARTY_ENCRYPTION_KEYS || config.thirdPartyEncryption.encryptionKeys;
ENCRYPTION_KEYS = typeof (ENCRYPTION_KEYS) === 'string' ? JSON.parse(ENCRYPTION_KEYS) : ENCRYPTION_KEYS;
class EncryptHelperUtil {
    async encrypt(data, client = null) {
        let cipher, crypted;
        try {
            logger.debug({
                event: '***** Entered function *****',
                functionName: 'encryptUtil.encrypt',
                data,
                TIMESTAMP: new Date().toISOString()
            });
            const { clientName, secretKey, initVector, isActive } = ENCRYPTION_KEYS[client] || { secretKey: null, initVector: null, isActive: null, clientName: null };

            logger.debug({
                event: '***** In function *****',
                functionName: 'encryptUtil.encrypt',
                data: { clientName, initVector, secretKey, isActive },
                TIMESTAMP: new Date().toISOString()
            });

            if (!secretKey || !initVector) {
                return { success: false, code: '999', data: { msg: 'Could not find encryption key' } };
            }

            if (isActive) {
                cipher = crypto.createCipheriv('aes-128-cbc', secretKey, initVector);
                crypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
                crypted += cipher.final('hex');
                return { success: true, code: '200', data: crypted.toUpperCase() };
            }
            else {
                return { success: false, code: '998', data: { msg: 'ThirdParty is Inactive' } }
            }

        } catch (error) {
            logger.debug({
                event: '***** In catch function *****',
                functionName: 'encryptUtil.encrypt',
                data: { error },
                TIMESTAMP: new Date().toISOString()
            });
            return { success: false, code: '500', data: { msg: 'Error Occurred', error } };
        }
    }

    async decrypt(data, client = null) {
        let decipher, decryted;
        try {
            logger.debug({
                event: '***** Entered function *****',
                functionName: 'encryptUtil.decrypt',
                data,
                TIMESTAMP: new Date().toISOString()
            });
            const { clientName, secretKey, initVector, isActive } = ENCRYPTION_KEYS[client] || { secretKey: null, initVector: null, isActive: null, clientName: null };

            if (!secretKey || !initVector) {
                return { success: false, code: '999', data: { msg: 'Could not find encryption key' } };
            }

            logger.debug({
                event: '***** In function *****',
                functionName: 'encryptUtil.decrypt',
                data: { clientName, initVector, secretKey, isActive },
                TIMESTAMP: new Date().toISOString()
            });

            if (isActive) {
                decipher = crypto.createDecipheriv('aes-128-cbc', secretKey, initVector)
                decryted = decipher.update(data, 'hex', 'utf8')
                decryted += decipher.final('utf8');
                return { success: true, code: '200', data: JSON.parse(decryted) };
            }
            else {
                return { success: false, code: '998', data: { msg: 'ThirdParty is Inactive' } }
            }
        } catch (error) {
            logger.debug({
                event: '***** In catch function *****',
                functionName: 'encryptUtil.decrypt',
                data: { error },
                TIMESTAMP: new Date().toISOString()
            });
            return { success: false, code: '500', data: { msg: 'Error Occurred', error } };
        }
    }
}
export default new EncryptHelperUtil();