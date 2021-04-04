# http2-express-autopush

express middleware for http2 auto push, based on h2-auto-push

## Installation

Can be installed same as any other npm package.

Node.js version 10 or higher is recommended.

```bash
$ npm install http2-express-autopush
```

## Server Push

One of the most hyped advantages of http2 is server push.

With server push, one can send the dependencies in the requested file like html file to be sent with the requested file.

for Example, if there is a js file required to be sent from the server that is required in the html file.

- In regular http or https connection, the client ( eg, browser) will request the html file and closes the connection. It realises that it requires a js file from the server as well. So, it opens another connection to request for the js file.

- In a http2, the server can decide to push the js file when the html file is requested, so that both the html and js file will be available in the browser with a single connection.

This leads to performance gains.

## Why AutoPush?

On the topic of server push, lots of guidelines have to be followed to have actual performance gains. See [Rules of Thumb for HTTP/2 Push](https://docs.google.com/document/d/1K0NykTXBbbbTlv60t5MyJvXjqKGsCVNYHyLEXIxYMv0/edit?usp=sharing) for the details.

TLDR, if the file is pushed all the time, even when it is already cached in the browser, It leads to worse performance. That's where http2-express-autopush middleware comes in.


## Usage

```js
const express = require('express')
const http2Express = require('http2-express-bridge')
const http2 = require('http2')
const { readFileSync } = require('fs')
const autopush = require('http2-express-autopush')

const app = http2Express(express)
const options = {
    key: readFileSync('<Certificate Key>'),
    cert: readFileSync('<Certificate file>'),
    allowHTTP1: true
};

//This is a string path of the root from which static files are served. second and third parameters are optional
app.use(autopush('<relative or absolute static path from which files are served>', {'staticOptions'}, {'assetCacheConfig'}))

app.get('/', function (req, res) {
  res.send('Hello World')
})

const server = http2.createSecureServer(options, app)

server.listen(3000, () => {
        console.log(`listening on port 3000`)
})
```

The middleware works exactly like "express.static" and will also accept a second parameter staticOptions like "express.static". 

The middleware will maintain a session long cookie in the browser. The cookie sends all the info about the files that were already sent to the browser and the server will not push it the next time.

The middleware will observe the requested path and record all the file paths that were immediately requested in the session. So, when the path is requested again from a different browser. It will push the recorded paths.

The Parameters to finetune the paths that are to be recorded and more about the middleware can be found in [h2-auto-push](https://www.npmjs.com/package/h2-auto-push). This is the third parameter in the function