const crypto = require('crypto');

const AES_KEY = process.env.MPIN_ENCRYPTION_KEY || config.mpinKey.value;
const Triple_DES_Key = process.env.MPIN_3DES_ENCRYPTION_KEY || config.tripleDESKey.value;
var iv = Buffer.from('jazzcashtestvect', 'utf8');


class CpsEncrypt{

  constructor(){

  }
  async encryptWith3DES(data) {
try {


    const cipher = crypto.createCipheriv('des-ede3', Buffer.from(Triple_DES_Key), "");

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}catch(ex){
  console.log(ex);
}
  }

  async encryptWithAES(data) {

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_KEY,'utf8'), iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
  };

  async decryptWithAES(data) {

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_KEY,'utf8') ,iv);
    let decrypted = decipher.update(data, 'base64');
    decrypted = decrypted + decipher.final('utf8')
    console.log(decrypted);
    return decrypted;
  };
}

export default new CpsEncrypt();