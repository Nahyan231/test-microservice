import validations from './validators/validatorEnhanced';
import raastService from '../../services/raastService';

import { HTTP_STATUS } from '../../util/constants';
import { successResponse, errorResponse, printLog, printError } from '../../util/utility';

class RaastController {
    constructor(service) {
        this.raastService = service;
        this.raastIncommingPayment = this.raastIncommingPayment.bind(this)
    }

    /**
     * @method raastIncommingPayment() // Raast P2M : Incoming Payment Flow
     * @param {Object} req // Request Object from API
     * @param {Object} res // Repsonse Object returned from services
     * @returns {Object}
     */

    async raastIncommingPayment(req, res) {

        printLog(
            'Entered function',
            'RaastController.raastIncommingPayment',
            { body: req.body, headers: req.headers },
        );

        try {

            const payload = req.body

            const headersValidationResponse = validations.verifySchema("RAAST_INCOMMING_HEADER", req.headers)

            printLog(
                'headers validation response',
                'RaastController.raastIncommingPayment',
                headersValidationResponse
            );

            if (!headersValidationResponse.success) {
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send(headersValidationResponse);
            }

            const validationResponse = validations.verifySchema("RAAST_INCOMMING_PAYLOAD", payload)

            printLog(
                'payload validation response',
                'RaastController.raastIncommingPayment',
                validationResponse
            );

            if (!validationResponse.success) {
                return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send(validationResponse);
            }

            payload.msisdn = req.get('X-MSISDN');
            payload.thirdParty = req.get("X-CHANNEL");
            let response = await raastService.raastIncommingPayment(payload);

            printLog(
                'Exited function',
                'RaastController.raastIncommingPayment',
                response
            );

            const { success = false } = response;

            if (success) {

                return successResponse(
                    res,
                    response
                );

            } else {

                return errorResponse(
                    res,
                    response
                );

            }
        } catch (error) {
            printError(error, 'RaastController.raastIncommingPayment');
            return errorResponse(
                res
            );
        }

    }
}

export default new RaastController(raastService);