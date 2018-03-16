# paypercall

[![npm release](https://img.shields.io/npm/v/paypercall.svg)](https://www.npmjs.com/package/paypercall)
[![MIT license](https://img.shields.io/github/license/shesek/paypercall.svg)](https://github.com/shesek/paypercall/blob/master/LICENSE)

Charge for HTTP APIs on a pay-per-call basis with Bitcoin and Lightning. Available as an express/connect middleware and as a reverse proxy.

Powered by :zap: [Lightning Charge](https://github.com/ElementsProject/lightning-charge).

## Install

```bash
$ npm install paypercall
```

## Server Setup

### As a middleware

`paypercall` can be used as an express/connect middleware to charge payments directly in your node.js app.
Below is an example app that charges 0.1 USD to send out tweets:

#### app.js
```js
const pay = require('paypercall')({ chargeUrl: ..., chargeToken: ... })
    , twt = require('twitter')({ consumer_key: ..., consumer_secret: ..., ... })
    , app = require('express')()

app.use(require('body-parser').urlencoded())

app.post('/tweet', pay(0.1, 'USD'), (req, res, next) =>
  twt.post('statuses/update', { status: req.body.message })
    .then(tweet => res.send(tweet))
    .catch(next))

app.listen(4000, _ => console.log('HTTP server running on localhost:4000'))
```

See [`ifpaytt`](https://github.com/shesek/ifpaytt) for a more full-fledged application using `paypercall` as a middleware.

### As a reverse proxy

Alternatively, you can develop your HTTP server with no payments awareness
and use `paypercall` as a reverse proxy to handle payments.
An example with a python app:

#### app.py
```python
from flask import Flask, request
import twitter

app = Flask(__name__)
twt = twitter.Api(consumer_key=..., consumer_secret=..., ...)

@app.route("/tweet", methods=['POST'])
def tweet():
    return twt.PostUpdate(request.form['message'])

@app.run(Port=4001)
```

Run the python app and the `paypercall` proxy:

```bash
$ FLASK_APP=app.py flask run
* Running on http://localhost:4001/

$ paypercall --charge-token mySecretToken --upstream-url http://localhost:4001 \
             --port 4000 --rates-yaml '{ POST /tweet: 0.1 USD }'
HTTP reverse proxy running on http://localhost:4000, proxying to http://localhost:4001
```

You will now have the python app running on port 4001 (providing API calls free of charge)
and the `paypercall` reverse proxy running on port 4000 (charging on a per-call basis).

## Paying for API calls

1. Send an empty request (no body) to the resource to get the BOLT11 payment request and the `X-Token` header:

    ```bash
    $ curl -i -X POST http://localhost:4000/tweet

    HTTP/1.1 402 Payment Required
    Content-Type: application/vnd.lightning.bolt11
    X-Token: lmbdmJeoSQ0ZCB5egtnph.af1eupleFBVuhN2vrbRuDLTlsnnUPYRzDWdL5HtWykY

    lnbcrt8925560p1pdfh7n2pp54g5avyupe70l988h30u0hy8agpj2z7qsveu7ejhys97j98rgez0...
    ```

2. Make the payment:

    ```bash
    $ lightning-cli pay lnbcrt8925560p1pdfh7n2pp54g5avyupe70l988h30u0hy8agpj2z7qsveu7ejhys97j98rgez0...
    ```

3. Send the request again, this time with the request body and with the `X-Token` header echoed back:

    ```bash
    $ curl -i -X POST http://localhost:4000/tweet \
      -H 'X-Token: lmbdmJeoSQ0ZCB5egtnph.af1eupleFBVuhN2vrbRuDLTlsnnUPYRzDWdL5HtWykY' \
      -d message='I got lightning working and all I got was this tweet'

    HTTP/1.1 200 OK
    Content-Type: application/json

    {"id_str":"123123123","text":"I got lightning working...",...}
    ```

## Documentation

### Middleware

```js
const pay = require('paypercall')(options)
```

Returns a new payment middleware factory. `options` can contain the following fields:

- `chargeUrl`: Lightning Charge server URL (optional, defaults to `http://localhost:9112`)
- `chargeToken`: Lightning Charge access token (**required**)
- `dbPath`: Path to sqlite database (optional, defaults to `./paypercall.db`)
- `currency`: Default currency if none is specified (optional, defaults to `BTC`)
- `secret`: Secret key used for HMAC tokens (optional, generated based on `chargeToken` by default)
- `invoiceExp`: How long should invoices be payable for (optional, defaults to 1 hour)
- `accessExp`: How long should paid access tokens remain valid for (optional, defaults to 1 hour)

```js
const payware = pay(amount[, currency])
```

Returns an express/connect middleware that requires a payment of `amount` units of `currency`
(or the default currency if none provided) before letting requests pass through.

Can be used as following:

```js
const pay = require('paypercall')({ chargeToken: 'myToken', currency: 'EUR' })
    , app = require('express')

// charge requests to a specific route
app.post('/sms', pay(0.15), (req, res) => { /* send SMS */ })

// charge all requests to /paid-apis/*
app.use('/paid-apis', pay(0.25))

// dynamic pricing (should only be based on the method and path)
app.post('/ocr/:type', (req, res, next) => {
  pay(getPriceForType(req.params.type))(req, res, (err) => {
    if (err) return next(err)
    // payment succesfull, run OCR
    // (the paid invoice is accessible at `req.invoice`)
  })
})
```

### Reverse proxy

```bash
$ paypercall --help

  Charge for HTTP APIs on a pay-per-call basis with Bitcoin and Lightning

  Usage
    $ paypercall [options]

  Options
    -c, --charge-url <url>      lightning charge server url [default: http://localhost:9112]
    -t, --charge-token <token>  lightning charge access token [required]

    -u, --upstream-url <url>    the upstream server to reverse proxy [required]
    -r, --rates-path <path>     path to YAML file mapping from endpoints to rates [default: ./rates.yaml]
    -y, --rates-yaml <yaml>     YAML string to use instead of reading from {rates-path}
    -x, --currency <name>       default rate currency if none is specified [default: BTC]
    -d, --db-path <path>        path to store sqlite database [default: ./payperclick.db]

    --invoice-expiry <sec>      how long should invoices be payable for [default: 1 hour]
    --access-expiry <sec>       how long should paid access tokens remain valid for [default: 1 hour]
    --token-secret <secret>     secret key used for HMAC tokens [default: generated based on {charge-token}]

    -p, --port <port>           http server port [default: 4000]
    -i, --host <host>           http server listen address [default: 127.0.0.1]
    -e, --node-env <env>        nodejs environment mode [default: production]
    -h, --help                  output usage information
    -v, --version               output version number

  Example
    $ payperclick -t myAccessToken -u http://upstream-server.com/ \
                  -y '{ POST /tweet: 0.0001 BTC, PUT /page/:id: 0.0002 BTC }'
```

## License
MIT
