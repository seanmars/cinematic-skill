// Thrown by a route handler; the API answers with its status and message.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function badRequest(message) {
  return new HttpError(400, message)
}
