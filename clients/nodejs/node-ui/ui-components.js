class Overlay {
    constructor(id, el) {
        this._id = id;
        this._el = el;
        const closeButton = el.querySelector('.overlay-close');
        if (closeButton) closeButton.addEventListener('click', this.hide.bind(this));
        el.addEventListener('click', event => {
            if (event.target === el) {
                // clicked on the background container
                this.hide();
            }
        });
    }

    show() {
        const previousOverlay = document.body.getAttribute('overlay');
        if (previousOverlay !== this._id) {
            this._previousOverlay = previousOverlay;
        }
        document.body.setAttribute('overlay', this._id);
    }

    hide() {
        if (this._previousOverlay) {
            document.body.setAttribute('overlay', this._previousOverlay);
        } else {
            document.body.removeAttribute('overlay');
        }
    }
}

