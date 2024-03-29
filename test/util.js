const winston = require('winston');

module.exports = {
    logger: () => winston.createLogger({
        transports: [new winston.transports.Console({silent: true})],
    }),
};
