import mongoose, {
    MongooseDocument
  } from 'mongoose';
  import logger from './logger';
  
  const connectionString = process.env.MONGO_CONNECTION || config.mongodb.connectionString;
  
  const options = {
    maxpoolSize:20 // will be tuned further if needed 
    // keepAlive: true, keepAliveInitialDelay: 20000, // keep connection alive for slow queries
    // useNewUrlParser: true,
    // useFindAndModify: false,
    // useCreateIndex: true,
    // useUnifiedTopology: true
  }
  
  
  class Database {
    constructor() {
      this._connect();
    }
  
    _connect() {
      /*mongoose.set('useNewUrlParser', true);
      mongoose.set('useFindAndModify', false);
      mongoose.set('useCreateIndex', true);
      mongoose.set('useUnifiedTopology', true);*/
  
      logger.info('Connection String =>');
      logger.info(connectionString);
  
      
      mongoose
        .connect(connectionString,options)
        .then(() => {
          logger.info('Database connection successful');
        })
        .catch((err) => {
          logger.error(err);
          logger.error('Database connection error');
        });
    }
  }
  
  export default new Database();
