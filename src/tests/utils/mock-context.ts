// src/tests/utils/mock-context.ts
import Application, { Context, Request, Response } from "koa";
import http from "http";
import createHttpError from "http-errors";

/**
 * Represents a mocked request object extending Koa's Request
 * @property {any} [body] - The request body
 * @property {any} [query] - The query parameters
 * @property {string} [method] - The HTTP method
 * @property {string} [url] - The request URL
 * @property {Record<string, string>} [header] - Request headers
 * @property {Record<string, string>} [headers] - Alternative request headers
 */
export type MockRequest = {
  body?: any;
  query?: any;
  method?: string;
  url?: string;
  header?: Record<string, string>;
  headers?: Record<string, string>;
} & Request;

/**
 * Options for creating a mock context
 * @property {MockRequest} [request] - Mock request options
 * @property {Partial<Response>} [response] - Mock response options
 */
type MockContextOptions = {
  request?: MockRequest;
  response?: Partial<Response>;
} & Partial<Context>;

/**
 * Creates a mock Koa context for testing purposes
 *
 * @param {MockContextOptions} [options={}] - Configuration options for the mock context
 * @returns {Context} A mocked Koa context object
 *
 * @example
 * const ctx = createMockContext({
 *   request: { method: 'POST', body: { foo: 'bar' } }
 * });
 */
export const createMockContext = (
  options: MockContextOptions = {}
): Context => {
  // Create default request with required properties
  const defaultRequest: Request = {
    app: {} as Application,
    req: {} as http.IncomingMessage,
    res: {} as http.ServerResponse,
    ctx: {} as Context,
    method: "GET",
    url: "",
    header: {},
    headers: {},
    body: {},
    query: {},
    originalUrl: "",
    origin: "",
    href: "",
    path: "",
    querystring: "",
    search: "",
    host: "",
    hostname: "",
    ...options.request,
  };

  /**
   * Create the mock context with default values and custom options
   */
  const ctx = {
    request: defaultRequest,
    response: {
      body: {},
      status: 200,
      ...options.response,
    },
    params: {},
    query: {},
    state: {},
    /**
     * Mock implementation of Koa's throw function
     * @param {number | string | Error} statusOrError - HTTP status code or error
     * @param {string | number} [messageOrCode] - Error message or status code
     * @param {Record<string, unknown>} [properties] - Additional error properties
     * @throws {HttpError} Throws an HTTP error with the specified parameters
     */
    throw: function (
      statusOrError: number | string | Error,
      messageOrCode?: string | number,
      properties?: Record<string, unknown>
    ): never {
      if (typeof statusOrError === "number") {
        throw createHttpError(
          statusOrError,
          messageOrCode as string,
          properties
        );
      } else if (typeof statusOrError === "string") {
        throw createHttpError(
          (messageOrCode as number) || 500,
          statusOrError,
          properties
        );
      } else {
        throw createHttpError(
          (messageOrCode as number) || 500,
          statusOrError.message,
          properties
        );
      }
    },
    body: {},
    status: 200,
    ...options,
  } as Context;

  return ctx;
};
