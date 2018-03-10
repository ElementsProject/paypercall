# paypercall

Charge for HTTP APIs on a pay-per-call basis with Bitcoin and Lightning. Available as an express/connect middleware and as a reverse proxy.

Powered by :zap: [Lightning Charge](https://github.com/ElementsProject/lightning-charge).

## Install

```bash
$ npm install paypercall
```

## Getting Started

### As a middleware

`paypercall` can be used as an express/connect middleware to charge payments directly in your node.js app.
Below is an example app that charges 0.1 EUR to send out tweets:

```js
const pay = require('paypercall')({ chargeUrl: ..., chargeToken: ... })
    , twt = require('twitter')({ consumer_key: ..., consumer_secret: ..., ... })
    , app = require('express')()

app.use(require('body-parser').urlencoded())

app.post('/tweet', pay(0.1, 'EUR'), (req, res, next) =>
  twt.post('statuses/update', { status: req.body.message })
    .then(tweet => res.send(tweet))
    .catch(next))

app.listen(4000, _ => console.log('HTTP server running on localhost:4000'))
```

### As a reverse proxy

Alternatively, you can develop your HTTP server with no payments awareness
and use `paypercall` as a reverse proxy to handle payments.
An example with a python app:

#### app.py
```python
import twitter
from flask import Flask, request

twt = twitter.Api(consumer_key=..., consumer_secret=..., ...)

app = Flask(__name__)

@app.route("/tweet", methods=['POST'])
def tweet():
    return twt.PostUpdate(request.form['message'])

@app.run(Port=4001)
```

#### paypercall.yaml
```yaml
chargeUrl: http://localhost:9112
chargeToken: mySecretToken

port: 4000
upstreamUrl: http://localhost:4001

endpoints:
  POST /tweet: 0.1 EUR
```

#### run
```bash
$ FLASK_APP=app.py flask run
* Running on http://localhost:4001/

$ paypercall paypercall.yaml
HTTP server running on localhost:4000
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
- `secret`: Secret key to use for token generation (optional, generated based on `chargeToken` by default)
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
$ paypercall ./path/to/config.yaml
```

The YAML configuration file can contain the same options as above,
plus the following:

- `upstreamUrl`: the upstream server to reverse-proxy (**required**)
- `endpoints`: an object where the key is `[method] [path]` (e.g. `POST /tweet`)
  and the value is the cost-per-call (e.g. `0.5 USD`, or simply `0.5` to use the default currency) (**required**)
- `port`: the port the reverse proxy should listen on (optional, defaults to `4000`)
- `host`: the address the reverse proxy should listen on (optional, defaults to `127.0.0.1`)

## License
MIT
