var fs = require('fs'),
    monzo = require('mondo-bank'),
    args = require('yargs').argv,
    config = JSON.parse(fs.readFileSync('config/monzo.json'));

function exit(scope) {
    return function (err) {
        console.error('Error with', scope, err);
        throw new Error(err.error.message);
    };
}

function timestamp(date) {
    return date ? date + 'T00:00:00Z' : undefined;
}

monzo.accounts(config.token).then(function (response) {
    monzo.transactions({
      account_id: response.accounts[0].id,
      since:      timestamp(args.from),
      before:     timestamp(args.to)
    }, config.token).then(function (response) {
        console.log(reponse.transactions);
    }).catch(exit('transactions'));
}).catch(exit('accounts'));
