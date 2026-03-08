export function createRequestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getRequestErrorStatusCode(error) {
  if (!Number.isInteger(error?.statusCode)) {
    return false;
  }

  return error.statusCode;
}
