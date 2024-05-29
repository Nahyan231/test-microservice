
import qrPaymentController from '../controllers/qrPaymentController';
import raastP2mController from '../controllers/raastP2mController';
import raastController from '../controllers/raastController'
import { msisdnParserMW } from '../middlewares';
import isTokenValid from '../middlewares/tokenValiadtion';

export default (app) => {

    // * QR Payments
    app.post('/rest/api/v1/payment/qrpayment/merchantdetails', msisdnParserMW(), isTokenValid, qrPaymentController.merchantDetails); // payment
    app.post('/rest/api/v2/payment/qrpayment/merchantdetails', msisdnParserMW(), isTokenValid, qrPaymentController.merchantDetails2);
    app.get('/rest/api/v1/payment/qrpayment/history', msisdnParserMW(), isTokenValid, qrPaymentController.recentScans);
    app.get('/rest/api/v1/payment/qrpayment/recentscans', msisdnParserMW(), isTokenValid, qrPaymentController.recentScans);
    app.get('/rest/api/v1/payment/qrpayment/transactions', msisdnParserMW(), isTokenValid, qrPaymentController.transactionHistory);
    app.post('/rest/api/v1/payment/qrpayment/init', isTokenValid, qrPaymentController.qrPaymentInit); // payment
    app.post('/rest/api/v1/payment/qrpayment/confirm', msisdnParserMW({ bodyKeys: ['msisdn'] }), isTokenValid, qrPaymentController.qrPaymentConfirm); // payment
    app.post('/rest/api/v1/payment/qrpayment/mastercard', msisdnParserMW(), isTokenValid, qrPaymentController.qrMastercardPayment);
    app.post('/rest/api/v1/payment/qrrefund/init', msisdnParserMW({ bodyKeys: ['msisdn'] }), isTokenValid, qrPaymentController.qrRefundInit);
    app.post('/rest/api/v1/payment/qrrefund/confirm', msisdnParserMW({ bodyKeys: ['msisdn'] }), isTokenValid, qrPaymentController.qrRefundConfirm);
    app.put('/rest/api/v1/payment/qrrating/add', isTokenValid, qrPaymentController.qrAddRating);
    app.post('/rest/api/v3/payment/qrpayment/merchantdetails', msisdnParserMW(), isTokenValid, raastP2mController.merchantDetails);
    app.post('/rest/api/v1/qrpayment/p2m/history', raastP2mController.p2mHistory);
    app.post('/rest/api/v1/raast/p2m/payment', msisdnParserMW({ bodyKeys: ['msisdn'] }), raastP2mController.p2mConfirm)

    app.post('/rest/api/v1/payment/qrpayment/updatedetails', isTokenValid, qrPaymentController.updateDetails);
    //app.put('/rest/api/v1/payment/qrpayment/updatedetails/:tillNumber', msisdnParserMW(), isTokenValid, qrPaymentController.updateDetails); 
    // * Raast P2M
    app.post('/rest/api/v1/raast/qrpayment/incomming', msisdnParserMW({ bodyKeys: ['msisdn'] }), isTokenValid, raastController.raastIncommingPayment)
    // p2m Refund
    app.post('/rest/api/v1/raast/p2m/refund', msisdnParserMW(), isTokenValid, qrPaymentController.p2mRefund);

    // QR Display V2
    app.get('/rest/api/v2/qrpayment/qrcode/display', isTokenValid, qrPaymentController.displayQRV2);

    // QR Generation For Thirdparties
    app.get('/rest/api/v1/thirdparty/generate/static/qrcode', msisdnParserMW(), isTokenValid, qrPaymentController.thirdpartyStaticQR);
    app.get('/rest/api/v1/thirdparty/generate/dynamic/qrcode', msisdnParserMW(), isTokenValid, qrPaymentController.thirdpartyDynamicQR);

};
