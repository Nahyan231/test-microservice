const NodeCache = require('node-cache')
const expireSeconds = process.env.LOCAL_CACHE_EXPIRE_SECONDS || 14400 // defaults to 4 hours
const checkperiod = 3600 // check every nth second if the event handler for expired cache needs to be triggered 
console.log(`Setting up a local cache for ${expireSeconds} seconds and checkperiod of ${checkperiod} seconds`)
const localCache = new NodeCache({stdTTL:expireSeconds,checkperiod,useClones:false})
localCache.on( "expired", ( key, value )=>{
    console.log(`The local cache's value with the key ${key} has expired within the last 1 hour !`)
});

module.exports = localCache