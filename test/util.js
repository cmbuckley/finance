const winston = require('winston');
const Transport = require('winston-transport');
const debug = require('debug')('test:logs');

module.exports = {
    logger: () => winston.createLogger({
        transports: [new Transport({
            log: (info, cb) => { debug(info); cb(); },
        })],
    }),
};
