enum ErrorCodes {
    /**
     * The requester has send wrong payload to the server which the server rejects.
     */
    INVALID_REQUEST_PAYLOAD = 4000,
    /**
     * The requester has send wrong parameters to the server which the server rejects.
     */
    INAVLID_REQUEST_PARAMETER = 4001,
    /**
     * The requester has send wrong Content-Type to the server which the server does not support.
     */
    INVALID_CONTENT_TYPE = 4002,
    /**
     * The requester has sent a request to a route which does not exist.
     */
    INVALID_ROUTE = 4003,
    /**
     * The requester has send a payload which the server cannot process.
     */
    REQUEST_UNACCEPTABLE = 4004,
    /**
     * The requester has asked the server to get a resource which currently doesnot exist.
     */
    RESOURCE_NOT_FOUND = 4005,
    /**
     * The requester has made a request to a route where the request method is not allowed.
     */
    INVALID_REQUEST_METHOD = 4006,
    /**
     * The requester has send a request to the server but the server is taking too much time to send the response.
     */
    REQUEST_TIMEDOUT = 4007,
    /**
     * The requester is trying to login but has send the wrong password.
     */
    INVALID_PASSWORD = 4010,
    /**
     * The requester is trying to login but has send the wrong username.
     */
    INVALID_USERNAME = 4011,
    /**
     * The requester has send a invalid email address.
     */
    INVALID_EMAIL = 4012,
    /**
     * The requester has send a invalid phone number.
     */
    INVALID_PHONE_NUMBER = 4013,
    /**
     * The requester is trying to sign-up but the password and confirm password fields donot match.
     */
    PASSWORDS_DO_NOT_MATCH = 4014,
    /**
     * The requester has send a invalid email address.
     */
    EMAIL_VERIFICATION_FAILED = 4016,
    /**
     * The requester has send a invalid phone number.
     */
    PHONE_NUMBER_VERIFICATION_FAILED = 4017,
    /**
     * The requester trying to login but the username or password doesnot exist in the database.
     */
    INVALID_CREDENTIALS = 4018,
    /**
     * The requester has send a Password which doesnot exist in the database.
     */
    SERVER_ERROR = 5000,
}

export default ErrorCodes;
