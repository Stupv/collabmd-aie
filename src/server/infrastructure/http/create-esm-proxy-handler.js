import { createRequestError } from "./http-errors.js";
import { sendResponse, textResponse } from "./http-response.js";

const ESM_PROXY_PREFIX = "/_esm/";
const ESM_UPSTREAM_ORIGIN = "https://esm.sh";
const ESM_TEXT_CONTENT_TYPE_PATTERN =
  /\b(?:javascript|ecmascript|css|json|text\/plain|text\/css)\b/i;

function rewriteEsmText(body) {
  return body
    .replace(/((?:from|import)\s*(?:\(\s*)?["'])\/(?!_esm\/)/g, "$1/_esm/")
    .replace(/((?:import|url)\(\s*["']?)\/(?!_esm\/)/g, "$1/_esm/")
    .replace(/(@import\s+["'])\/(?!_esm\/)/g, "$1/_esm/");
}

function looksLikeHtmlDocument(body) {
  const trimmed = body.trimStart();
  return (
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML") ||
    trimmed.startsWith("<?xml")
  );
}

function isEsmProxyPath(pathname) {
  return pathname === "/_esm" || pathname.startsWith(ESM_PROXY_PREFIX);
}

function resolveEsmUpstreamUrl(requestUrl) {
  const proxiedPath =
    requestUrl.pathname === "/_esm"
      ? ""
      : requestUrl.pathname.slice(ESM_PROXY_PREFIX.length);

  if (!proxiedPath) {
    throw createRequestError(400, "Missing esm.sh module path");
  }

  return new URL(
    `${proxiedPath}${requestUrl.search}`,
    `${ESM_UPSTREAM_ORIGIN}/`,
  ).toString();
}

export function createEsmProxyHandler() {
  const esmAssetCache = new Map();

  async function fetchEsmAsset(upstreamUrl) {
    if (!globalThis.fetch) {
      throw createRequestError(
        500,
        "Global fetch is unavailable for esm proxy",
      );
    }

    if (!esmAssetCache.has(upstreamUrl)) {
      esmAssetCache.set(
        upstreamUrl,
        (async () => {
          let lastError = null;

          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              const response = await globalThis.fetch(upstreamUrl, {
                headers: {
                  Accept:
                    "text/javascript, application/javascript, text/css;q=0.9, */*;q=0.5",
                },
                redirect: "follow",
              });

              if (!response.ok) {
                throw createRequestError(
                  502,
                  `esm.sh responded with ${response.status}`,
                );
              }

              const contentType =
                response.headers.get("content-type") ||
                "application/octet-stream";
              const cacheControl =
                response.headers.get("cache-control") || "public, max-age=300";

              if (ESM_TEXT_CONTENT_TYPE_PATTERN.test(contentType)) {
                const text = await response.text();
                if (looksLikeHtmlDocument(text)) {
                  throw createRequestError(
                    502,
                    "esm.sh returned HTML for a module asset",
                  );
                }

                return {
                  body: rewriteEsmText(text),
                  cacheControl,
                  contentType,
                };
              }

              return {
                body: Buffer.from(await response.arrayBuffer()),
                cacheControl,
                contentType,
              };
            } catch (error) {
              lastError = error;
            }
          }

          throw (
            lastError || createRequestError(502, "Failed to fetch esm.sh asset")
          );
        })().catch((error) => {
          esmAssetCache.delete(upstreamUrl);
          throw error;
        }),
      );
    }

    return esmAssetCache.get(upstreamUrl);
  }

  return async function handleEsmProxy(req, res, requestUrl) {
    if (!isEsmProxyPath(requestUrl.pathname)) {
      return false;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      textResponse(req, res, 405, "Method Not Allowed");
      return true;
    }

    try {
      const upstreamUrl = resolveEsmUpstreamUrl(requestUrl);
      const asset = await fetchEsmAsset(upstreamUrl);
      sendResponse(req, res, {
        body: asset.body,
        headers: {
          "Cache-Control": asset.cacheControl,
          "Content-Type": asset.contentType,
        },
        statusCode: 200,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 502;
      console.error(
        `[http] Failed to proxy "${requestUrl.pathname}":`,
        error.message,
      );
      textResponse(req, res, statusCode, "Bad Gateway", {
        "Cache-Control": "no-store",
      });
    }

    return true;
  };
}
