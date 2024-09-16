# Transactions Downloader

A CLI application to download transactions from various financial institutions.

To install, first run `npm install` and then you'll need to configure your providers as listed below.

## Usage

```
Usage: npm run download -- [options...]

Filtering transactions:
  -a, --account  Which account(s) to load
  -f, --from     Earliest date for transactions
  -t, --to       Latest date for transactions

Storage/retrieval:
  -o, --format             Output format (csv/qif)
  -d, --dump               Dump transactions to specified file
  -u, --load               Load from a specified dump file
  -s, --store              Store transactions in specified folder (default "db")
  -r, --retrieve           Retrieve transactions from folder (default "db")
      --pokerstars-source  Source file for PokerStars input

Options:
  -h, --help      Show help
  -V, --version   Show version number
  -l, --login     Force OAuth re-login for selected accounts
  -r, --retrieve  Retrieve transactions from specified folder
  -q, --quiet     Suppress output
  -v, --verbose   Verbose output (multiple options increases verbosity)

Valid accounts:
  TrueLayer: amex, fd, hsbc, revolut, starling
  Monzo: mc, mj, mp
  Custom: paypal
  Experimental: t212, kraken, pokerstars
```

On the first use of a given account/adapter, you will need to log in using to your bank and grant permission to read information about the transactions. An access token is stored in the `config/` directory and will be reused on subsequent requests.

The from/to dates should be specified in RFC 3339 format (yyyy-mm-dd). Certain providers place restrictions on the oldest transactions available, or on the size of the date range.

## Export Configuration

Payees are not always populated from transaction merchant information; they must be explicitly set in `config/data.json`. This allows for more accurate payee info.

The following types of information can be added:

```json
{
  "payees": {
    "user_12345":        "Name of Monzo user",
    "anonuser_12345":    "Name of external user of Monzo",
    "ABCDE12345":        "PayPal merchant/user",
    "00-00-00 12345678": "Bank payee (Monzo)",
    "merch_12335":       "Monzo merchant",
    "grp_12335":         "Monzo merchant group"
  },
  "transfers": {
    "00-00-00 12345678": "Bank account (Monzo/TrueLayer)",
    "USD":               "Currency (Monzo cash withdrawal)",
    "grp_12335":         "Monzo merchant group",
    "acc_12345":         "Monzo account",
    "patterns": {
      "Account Name": "Description regex (TrueLayer)",
      "Other Account": {"pattern": "regex", "flags": "i"}
    }
  }
}
```

## Adapters

### TrueLayer

TrueLayer is a finance API platform that supports reading transactions from multiple Open Banking providers.

To create a Truelayer client:

1. Copy `config/truelayer-sample.json` to `config/truelayer.json`.
2. Head to https://console.truelayer.com/.
3. Click Create new application and follow the instructions.
4. Use the control in the console to switch from Sandbox to Live.
5. Copy the client ID and secret from the console and store them in `config/truelayer.json`.
6. In the Settings for the application, optionally add a Redirect URI to handle the OAuth callback.
7. In `config/truelayer.json`, set the `redirect_uri` option to the same URL.

The following account types use the Truelayer adapter:

* `amex` (American Express)
* `fd` (First Direct)
* `hsbc`
* `revolut`
* `starling`

This list can be expanded - see the spec in `src/adapter.js`. The provider IDs can be seen at https://auth.truelayer.com/api/providers.

#### Config Overrides

Account names default to the display names from the provider. To override these, set the `names` property in the adapter config.

For example, for the HSBC adapter, edit `config/hsbc.json` and add the following:

```json
{
  "names": {
    "abc123456": "Current Account"
  }
}
```

Account IDs can be seen in the verbose logs.

### Monzo

Monzo transactions are retrieved from the Monzo APIs for richer metadata.

To create a Monzo client:

1. Copy `config/monzo-sample.json` to `config/monzo.json`.
2. Head to https://developers.monzo.com/.
3. Log in using your account email and click the link in your email.
4. Open your Monzo app and click to approve access for the playground.
5. Click Clients, then New OAuth Client.
6. Add a name and a redirect URL (`http://localhost:3000` is the default server).
7. Select Confidential and click Submit.
8. Store the client ID, secret and optionally the redirect URL in `config/monzo.json`.

The following account types use the Monzo adapter:

* `mc` (current account)
* `mp` (Legacy prepaid account)
* `mj` (joint account)

#### Pots

Transfers to and from savings pots will be included in the output. Transactions within savings pots (e.g. interest) cannot be downloaded via the Monzo API. Round-up pots will not be included, as this can dilute the transaction history.

### PayPal

PayPal transactions can be downloaded from the PayPal reporting APIs. Unfortunately you need to convert your PayPal to a Business account to use these APIs. The downside of this is that when individuals send you money on PayPal, it defaults to "for good and services" which charges you a merchant fee. Make sure you tell them to switch to "for friends and family"!

To create a PayPal client:

1. Copy `config/paypal-sample.json` to `config/paypal.json`.
2. Head to https://developer.paypal.com/dashboard/.
3. Log in using your PayPal Business account.
4. Switch the dashboard from Sandbox to Live.
5. Click Apps & Credentials, then Create App and give it a name.
6. Store the client ID and secret in `config/paypal.json`.
