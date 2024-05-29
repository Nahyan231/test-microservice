
const isEsbRespSuccess = (servResp) => {

    return servResp && servResp.Response &&
        servResp.Response.ResponseCode === '0' &&
        servResp.Result &&
        servResp.Result.ResultCode === '0';

}

module.exports = {
    isEsbRespSuccess,
};