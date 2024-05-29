import logger from './logger';
import axios from 'axios';
import { isNull } from 'lodash';
import Subscriber from '../services/subscriberService';

const SMS_NOTIFICATION_URL = process.env.SMS_NOTIFICATION_URL || config.externalServices.NotificationService.smsNotificationUrl;
const EMAIL_NOTIFICATION_URL = process.env.EMAIL_NOTIFICATION_URL || config.externalServices.NotificationService.emailNotificationUrl;
const PUSH_NOTIFICATION_URL = process.env.PUSH_NOTIFICATION_URL || config.externalServices.NotificationService.pushNotificationUrl;
const PUSH_NOTIFICATION_MSISDN_URL = process.env.PUSH_NOTIFICATION_MISIDN_URL || config.externalServices.NotificationService.pushNotificationByMsisdnUrl;

class Notification {
    constructor() {
        this.subscriber = Subscriber.getInstance();
    }

    //added by kashif abbasi
    async sendPushNotificationDirect(PushID, DeviceType, templateName, templateData, otherData) {
        // templateName should be the name which you defined in notificationTemplates collection
        //templatedata: is an array of key value , which replace the keys in template, formate of Data should be , templateData: [{key: "customeName",value: "kashif"}]
        //otherData: is any an object of any data which is used to send in pushnotification ,format of otherData is, otherData: {"url": "www.jazzcash.com/7876","name","kashif"}
        try {
            if (otherData == null)
                otherData = {};

            let pushNotificationReqBody = {
                pushID: PushID,
                deviceType: DeviceType,
                payload: {
                    notification: {
                        template: templateName,
                        templateData: templateData,
                    },
                    data: otherData
                },

            };

            let Response = await axios
                .post(
                    PUSH_NOTIFICATION_URL,
                    pushNotificationReqBody
                )
                .then((response) => {
                    // logger.debug(response);
                    return true;
                })
                .catch((error) => {
                    // logger.debug(error);
                    return false;
                });
            return true;
        } catch (error) {
            logger.error(
                'Error in Notification.sendPushNotificationDirect from qrpayment microservice' +
                error
            );
            return false;
        }
    }

    //added by kashif abbasi dated 15-sep-2020
    async sendPushNotificationByMSISDNDirect(msisdn, customerType, templateName, templateData, otherData) {
        // templateName should be the name which you defined in notificationTemplates collection
        //templatedata: is an array of key value , which replace the keys in template, formate of Data should be , templateData: [{key: "customeName",value: "kashif"}]
        //otherData: is any an object of any data which is used to send in pushnotification ,format of otherData is, otherData: {"url": "www.jazzcash.com/7876","name","kashif"}
        try {
            if (otherData == null)
                otherData = {};
            if (templateData == null)
                templateData = [];

            let pushNotificationReqBody = {
                msisdn: msisdn,
                customerType: customerType,
                payload: {
                    notification: {
                        template: templateName,
                        templateData: templateData,
                    },
                    data: otherData
                },

            };

            let Response = await axios
                .post(
                    PUSH_NOTIFICATION_MSISDN_URL,
                    pushNotificationReqBody
                )
                .then((response) => {
                    logger.debug(response)
                    return true;
                })
                .catch((error) => {
                    logger.debug(error);
                    return false;
                });
            return true;
        } catch (error) {
            logger.error(
                'Error in Notification.sendPushNotificationByMSISDNDirect from qrpayment microservice' +
                error
            );
            return false;
        }
    }

    //added by kashif abbasi dated 27-Jul-2020
    async sendEmailDirect(To, Subject, HTML, Attachments, Template, Data) {
        try {
            //Attachmet should be array
            //1- if file present on disk than having two properties like this Attachments: [{"path": 'ww.googl.com/image.jpg', "embedImage": true}]
            //2- if file is in binary or base64 format than having 4 properties like this Attachments: [{"fileName": "test.png", content: "kjkjjhj", type:"base64", "embedImage": true}]

            let emailReqBody = {
                // Move from email to env variables
                //from: 'no-reply@JazzCash.com.pk',
                to: To,
                subject: Subject,
                html: HTML,
            };

            if (!isNull(Attachments)) {
                emailReqBody.attachments = Attachments;
            }

            /*if template is already defined then HTML would be overwritten with this template
              Data: is an array of key value , which replace the keys in template, formate of Data should be , data: [{key: "customeName",value: "kashif"}]
            */
            if (!isNull(Template) && Template != "") {
                emailReqBody.template = Template;
                emailReqBody.data = Data;
            }
            let Response = await axios
                .post(EMAIL_NOTIFICATION_URL, emailReqBody)
                .then((response) => {
                    //   logger.debug('Email sent successfully:',response);
                    return true;
                })
                .catch((error) => {
                    logger.debug('error in sending email; ', error);
                    return false;
                });
            return true;
        } catch (error) {
            logger.error(
                'Error in Notification.sendEmailDirect from qrpayment microservice' + error
            );
            return false;
        }
    }

    //added by kashif abbasi dated 17-sep-2020
    async sendSMSDirect(msisdn, customerType, templateName, data) {
        //customrType should be counsumer or merchant
        // templateName should be the name which you defined in notificationTemplates collection
        //data: is an array of key value , which replace the keys in template, formate of Data should be , data: [{key: "customeName",value: "kashif"}]
        try {

            let smsReqBody = {
                msisdn: msisdn,
                customerType: customerType,
                template: templateName,
            };

            if (!isNull(data))
                smsReqBody.data = data;
            else
                smsReqBody.data = [];

            await axios
                .post(SMS_NOTIFICATION_URL, smsReqBody)
                .then((response) => {
                    //   logger.debug('sms sent successfully:',response.data);
                    return true;
                })
                .catch((error) => {
                    logger.debug('error in sending sms; ', error);
                    return false;
                });
            return true;
        } catch (error) {
            logger.error('Error in Notification.sendSMSDirect from qrpayment microservice' + error);
            return false;
        }
    }

    //added by kashif abbasi
    async sendPushNotification(PushID, DeviceType, templateName, templateData, otherData) {
        // templateName should be the name which you defined in notificationTemplates collection
        //templatedata: is an array of key value , which replace the keys in template, formate of Data should be , templateData: [{key: "customeName",value: "kashif"}]
        //otherData: is any an object of any data which is used to send in pushnotification ,format of otherData is, otherData: {"url": "www.jazzcash.com/7876","name","kashif"}
        try {
            if (otherData == null)
                otherData = {};

            const kafkaPayload = {
                pushID: PushID,
                deviceType: DeviceType,
                payload: {
                    notification: {
                        template: templateName,
                        templateData: templateData,
                    },
                    data: otherData
                },
            };

            logger.info({
                event: 'Entered function',
                functionName: 'Notification.sendPushNotification',
                data: { body: kafkaPayload }
            });

            this.subscriber.event.produceMessage(kafkaPayload, config.kafkaBroker.topics.Notification_Push);
            return true;
        } catch (error) {
            logger.error({
                event: 'Exited function with error',
                functionName: 'Notification.sendPushNotification',
                error: {
                    message: error && error.message ? error.message : "",
                    stack: error && error.stack ? error.stack : ""
                },
            });
            return false;
        }
    }

    //added by Mahsam dated 09-dec-2022
    async sendPushNotificationByMSISDN(msisdn, customerType, templateName, templateData, otherData) {
        // templateName should be the name which you defined in notificationTemplates collection
        //templatedata: is an array of key value , which replace the keys in template, formate of Data should be , templateData: [{key: "customeName",value: "kashif"}]
        //otherData: is any an object of any data which is used to send in pushnotification ,format of otherData is, otherData: {"url": "www.jazzcash.com/7876","name","kashif"}
        try {
            let kafkaPayload = {
                msisdn: msisdn,
                customerType: customerType,
                payload: {
                    notification: {
                        template: templateName,
                        templateData: templateData
                    },
                    data: otherData || {}
                },

            };

            logger.info({
                event: 'Entered function',
                functionName: 'Notification.sendPushNotificationByMSISDN',
                data: { body: kafkaPayload }
            });

            this.subscriber.event.produceMessage(kafkaPayload, config.kafkaBroker.topics.Notification_Push);
            return true;
        } catch (error) {
            logger.error({
                event: 'Error thrown',
                functionName: 'Notification.sendPushNotificationByMSISDN in ',
                error: { message: error.message, stack: error.stack }
            });
            return false;
        }
    }

  //added by mahsam dated 05-Dec-2022
    async sendEmail(To, Subject, HTML, Attachments, Template, Data) {
        try {
            //Attachmet should be array
            //1- if file present on disk than having two properties like this Attachments: [{"path": 'ww.googl.com/image.jpg', "embedImage": true}]
            //2- if file is in binary or base64 format than having 4 properties like this Attachments: [{"fileName": "test.png", content: "kjkjjhj", type:"base64", "embedImage": true}]

            let kafkaPayload = {
                // Move from email to env variables
                //from: 'no-reply@JazzCash.com.pk',
                to: To,
                subject: Subject,
                html: HTML,
            };

            if (!isNull(Attachments)) {
                kafkaPayload.attachments = Attachments;
            }

            /*if template is already defined then HTML would be overwritten with this template
              Data: is an array of key value , which replace the keys in template, formate of Data should be , data: [{key: "customeName",value: "kashif"}]
            */
            if (!isNull(Template) && Template != "") {
                kafkaPayload.template = Template;
                kafkaPayload.data = Data;
            }

            logger.info({
                event: 'Entered function',
                functionName: 'Notification.sendEmail',
                data: { body: kafkaPayload }
            });

            this.subscriber.event.produceMessage(kafkaPayload, config.kafkaBroker.topics.Notification_Email);

            return true;
        } catch (error) {
            logger.error({
                event: 'Exited function with error',
                functionName: 'Notification.sendEmail',
                error: {
                    message: error && error.message ? error.message : "",
                    stack: error && error.stack ? error.stack : ""
                },
            });
            return false;
        }
    }

    //added by mahsam dated 05-Dec-2022
    async sendSMS(msisdn, customerType, templateName, data) {
        try {

            let kafkaPayload = {
                msisdn: msisdn,
                customerType: customerType,
                template: templateName,
            };

            if (!isNull(data))
                kafkaPayload.data = data;
            else
                kafkaPayload.data = [];


            logger.info({
                event: 'Entered function',
                functionName: 'Notification.sendSMS',
                data: { body: kafkaPayload }
            });

            this.subscriber.event.produceMessage(kafkaPayload, config.kafkaBroker.topics.Notification_Sms);

            return true;
        } catch (error) {
            logger.error({
                event: 'Exited function with error',
                functionName: 'Notification.sendSMS',
                error: {
                    message: error && error.message ? error.message : "",
                    stack: error && error.stack ? error.stack : ""
                },
            });
            return false;
        }
    }

}
export default new Notification();