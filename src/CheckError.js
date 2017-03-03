export default class CheckError {
  constructor(msg) {
    this.message = `Match error: ${msg}`;

    Error.captureStackTrace(this);
  }
}
