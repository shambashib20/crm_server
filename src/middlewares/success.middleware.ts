export default class SuccessResponse {
  message: string;
  status:
    | "SUCCESS"
    | "CREATED"
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "SERVER_ERROR";
  data?: any;

  constructor(message: string, statusCode: number, data?: any) {
    this.message = message;
    this.status = this.getStatus(statusCode);
    this.data = data;
  }

  private getStatus(statusCode: number) {
    switch (statusCode) {
      case 200:
        return "SUCCESS";
      case 201:
        return "CREATED";
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 500:
      default:
        return "SERVER_ERROR";
    }
  }
}
