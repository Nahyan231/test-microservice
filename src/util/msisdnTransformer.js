
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

/* 
app.get('/formatnumbers', async function(req, res){
    var numbers = ["923219272700","+923219272700","00923219272700","03219272700","00201063191051","+201063191051","+92515567328","+3042226922", "+9251556328","+9234593845334","0515567328","92515567328","03235004032","0300534343"];
    logger.debug("Local format single: " + formatNumberSingle("923219272700", "local"));
    logger.debug("International format single: " + formatNumberSingle("923219272700", "international"));
    logger.debug("Local format list: " + formatNumberList(numbers,"local"));
    logger.debug("International format list: " + formatNumberList(numbers,"international"));
    res.json(true);
});

*/

class MSISDNTransformer {

  constructor() {  }

  formatNumberList(numList, formatType){
    var fixedNumbers = [];
    numList.forEach((number) => {
        let phoneNumberParsed = parsePhoneNumberFromString(number, 'PK');
        if (phoneNumberParsed && phoneNumberParsed.country === "PK" && phoneNumberParsed.getType() === "MOBILE") {
            var phoneStr = "";
            if (formatType === "local"){
                phoneStr = phoneNumberParsed.formatNational();
            } else {
                phoneStr = phoneNumberParsed.formatInternational();
            }
            var fixedPhoneNumber = phoneStr.replace("+","").replace(/\s/g, '');
            fixedNumbers.push(fixedPhoneNumber);
            //logger.debug(fixedPhoneNumber + " " + phoneNumberParsed.getType());
        }
    });
    return fixedNumbers;
  };
  
  formatNumberSingle(phoneNumber, formatType){
    let phoneNumberParsed = parsePhoneNumberFromString(phoneNumber, 'PK');
    if (phoneNumberParsed && phoneNumberParsed.country === "PK" && phoneNumberParsed.getType() === "MOBILE") {
        var phoneStr = "";
        if (formatType === "local"){
            phoneStr = phoneNumberParsed.formatNational();
        } else {
            phoneStr = phoneNumberParsed.formatInternational();
        }
        var fixedPhoneNumber = phoneStr.replace("+","").replace(/\s/g, '');
        //logger.debug(fixedPhoneNumber + " " + phoneNumberParsed.getType());
        return fixedPhoneNumber;
    }
  };


}

export default new MSISDNTransformer();