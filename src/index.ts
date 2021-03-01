///<reference types='express'/>

import * as http2 from 'http2'
import * as http from 'http'
import * as https from 'https'
import * as path from 'path'
import * as fs from 'fs'

import staticServe, { ServeStaticOptions } from 'serve-static'
import * as h2Auto from 'h2-auto-push';
import * as cookie from 'cookie'
import { NextFunction, RequestHandler, Response } from 'express'

export { AssetCacheConfig } from 'h2-auto-push'

export type HttpServer =
  | http.Server
  | https.Server
  | http2.Http2Server
  | http2.Http2SecureServer;
export type RawRequest = http.IncomingMessage | http2.Http2ServerRequest;
export type RawResponse = http.ServerResponse | http2.Http2ServerResponse;


function isHttp2Request(req: RawRequest): req is http2.Http2ServerRequest {
    return !!(req as http2.Http2ServerRequest).stream;
}
  
function isHttp2Response(res: RawResponse): res is http2.Http2ServerResponse {
    return !!(res as http2.Http2ServerResponse).stream;
}

function isStatic(url: string, root: string): boolean{
    try {
        const filePath = path.join(root, url)
        const stat = fs.statSync(filePath)
        return stat.isFile()
    } catch(err) {
        return false
    }
}

const CACHE_COOKIE_KEY = '__ap_cache__'

export { ServeStaticOptions }

export default function serveAutoPush(root:string, staticOptions?: staticServe.ServeStaticOptions<Response> , cacheConfig?: h2Auto.AssetCacheConfig): RequestHandler[] {
    
    if(!root) {
        throw Error('root path required')
    }

    if(typeof root !== 'string') {
        throw Error('root path must be a string')
    }

    const rootDir = path.resolve(root)

    let ap: h2Auto.AutoPush

    if(cacheConfig) {
        ap = new h2Auto.AutoPush(root, cacheConfig)
    } else {
        ap = new h2Auto.AutoPush(root)
    }

    return [
        async function (req: RawRequest, res: RawResponse, next: NextFunction) {

            if(isHttp2Request(req) && isHttp2Response(res)) {

                try {

                    const reqPath = req.url
                    const reqStream = req.stream;
                    const cookies = cookie.parse(
                        (req.headers['cookie'] as string) || ''
                    )
                    const cacheKey = cookies[CACHE_COOKIE_KEY];

                    const {newCacheCookie, pushFn} = await ap.preprocessRequest( reqPath, reqStream, cacheKey)

                    res.setHeader(
                        'set-cookie',
                        cookie.serialize(CACHE_COOKIE_KEY, newCacheCookie, { path: '/' })
                    )
                
                    reqStream.on('pushError', err => {
                        console.error('Error while pushing', err)
                    });

                    const resStream = res.stream

                    if (isStatic(req.url, rootDir)) {
                        ap.recordRequestPath(resStream.session, reqPath, true);
                    } else {
                        ap.recordRequestPath(resStream.session, reqPath, false);
                    }

                    pushFn().then(noop, noop)

                } catch(err) {
                    console.error('Error while autopush', err)
                }
            }

            next()

        },
        staticServe(rootDir, staticOptions)
    ]
}

function noop() {}

module.exports = serveAutoPush
module.exports.default = serveAutoPush