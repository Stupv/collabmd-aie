export function createGitRequestError(statusCode, message, requestCode = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (requestCode) {
    error.requestCode = requestCode;
  }
  return error;
}
