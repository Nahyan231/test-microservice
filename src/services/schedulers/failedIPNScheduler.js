import Agenda from 'agenda';
import mongoose from "mongoose";
import logger from '../../util/logger';
import qrPaymentHelper from '../helpers/qrPaymentHelper';

const connectionString = process.env.MONGO_CONNECTION || config.mongodb.connectionString;
const agenda = new Agenda({ db: { address: connectionString } });
const maxAttempts = process.env.maxFailedIPNAttempts || '3';
const jobInterval = process.env.FAILED_IPN_SCHEDULER_INTERVAL || '*/5 * * * *';
const schedulerRowsLimit = process.env.FAILED_IPN_SCHEDULER_MAX_ROWS || 10;

const jobName = "failedIPNScheduler";

class failedIPNScheduler {
    constructor(helper) {
        this.qrPaymentHelper = helper;
        this.createJob = this.createJob.bind(this);
        this.executeJob = this.executeJob.bind(this);
        this.createJob();
    }

    async createJob() {
        this.ipnFailureModel = mongoose.model("ipn_failure");
        agenda.define(jobName, { concurrency: 0 }, this.executeJob);
        await agenda.start();
        await agenda.every(jobInterval, jobName);
        this.executeJob();
    }

    async executeJob() {

        logger.info({
            event: 'Entered function',
            functionName: 'failedIPNScheduler.executeJob'
        });

        try {
            let failedIPNs = await this.ipnFailureModel.find({status: 'pending', attempts: {$lte: maxAttempts}}).lean().limit(parseInt(schedulerRowsLimit));

            logger.debug({
                event: 'List of Pending IPNs',
                functionName: 'failedIPNScheduler.executeJob',
                data: failedIPNs
            });

            if (failedIPNs.length > 0) {

                for(let i = 0; i < failedIPNs.length; i++){
                    failedIPNs[i].payload.maxAttempts = maxAttempts;
                    failedIPNs[i].payload.attempts = failedIPNs[i].attempts;

                    await qrPaymentHelper.triggerIPN(failedIPNs[i].payload);
                }

            }
        }
        catch (error) {
            logger.info({
                event: 'Catch block - Failed IPN executeJob',
                functionName: 'failedIPNScheduler.executeJob',
                data: {error, Msg: error?.message, Stack: error?.stack},
            });
        }
    }
}
export default new failedIPNScheduler(qrPaymentHelper);