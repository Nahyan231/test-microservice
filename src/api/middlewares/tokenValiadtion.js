import logger  from '../../util/logger';

const isTokenValidation= process.env.Token_Validation || 'false';

const isTokenValid = (req,res,next) =>
{

    try {
        logger.debug("Entered Token Validation MW");
        let metadatamsisdn = req.get('x-user-metadata');
        if(metadatamsisdn && metadatamsisdn != 'null'){
            logger.debug("Entered Authorization Flow");
            let msisdn= req.get('X-MSISDN');
            msisdn = msisdn[0] === '0' ? msisdn.replace('0','92'): msisdn;
            if (metadatamsisdn && metadatamsisdn.substring(0, 2) === "a:") metadatamsisdn = metadatamsisdn.replace("a:", "")
            let metadata = JSON.parse(metadatamsisdn);
            if (isTokenValidation == 'false' || !msisdn )
            { 
                return next();
            }
            if (metadata.a == msisdn) 
            {
                return next();
            }
            else 
            {
                res.status(403).send({ success: false, message: `Your Bearer Token is not valid against Msisdn [${msisdn}] .`, });
                return;
            }
        }else{
            logger.debug("Authorization Token Not Provided");
            return next();
        }
    }
    catch (error)
    {
        logger.error(error);
    }
next();
}

export default isTokenValid;
