/** Normalised error surface so the UI never has to branch per provider. */
export class AiError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'AiError';
    }
}
