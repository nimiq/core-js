class ErrorMessage extends Overlay {
    constructor(el) {
        super(ErrorMessage.ID, el);
        this._messageText = el.querySelector('#error-message-text');

        el.querySelector('#error-message-ok').addEventListener('click', () => this.hide());
    }

    static show(message) {
        ErrorMessage.instance.show(message);
    }

    static get instance() {
        ErrorMessage._instance = ErrorMessage._instance || new ErrorMessage(document.querySelector('#error-message'));
        return this._instance;
    }

    show(message) {
        this._messageText.textContent = message;
        super.show();
    }
}
ErrorMessage.ID = 'error-message';
