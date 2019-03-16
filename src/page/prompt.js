const moment = window.moment;
const ipcRenderer = window.ipcRenderer;

var promptId = null;

const promptError = e => {
	if (e instanceof Error) {
		e = e.message;
	}
	ipcRenderer.sendSync('prompt-error:' + promptId, e);
};

const promptCancel = () => {
	ipcRenderer.sendSync('prompt-post-data:' + promptId, null);
};

const promptSubmit = (event) => {
    let tempForm = null;
    if(event) {
        event.preventDefault();
        if(event.callingTarget && event.callingTarget.form) {
            //Get the form which has the submit button
            tempForm = event.callingTarget.form;
        }
    }
    if(!tempForm) {
        tempForm = document.getElementById('dataCollection');
    }
	let data = formToJSON(tempForm.elements);
	ipcRenderer.sendSync('prompt-post-data:' + promptId, data);
};

const formToJSON = elements => [].reduce.call(elements, (data, element) => {
    if(!isBlank(element.name) && !isBlank(element.value)) {
        if(['checkbox', 'radio'].includes(element.type)) {
            data[element.name] = element.checked;
        } else {
            data[element.name] = element.value;
        }
    }
    return data;
}, {});

window.addEventListener('error', error => {
	if(promptId) {
		promptError(error);
	}
});

ready(() => {
    promptId = document.location.hash.replace('#', '');
    
    const form = document.getElementById('dataCollection');
    form.addEventListener('submit', promptSubmit);
	//document.getElementById('ok').addEventListener('click', () => promptSubmit());

		/*dataEl.addEventListener('keyup', e => {
			e.which = e.which || e.keyCode;
			if (e.which === 13) {
				promptSubmit();
			}
			if (e.which === 27) {
				promptCancel();
			}
		});*/
});

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

function ready(callback) {
    if(typeof document === 'undefined') {
        throw new Error('document-ready only runs in the browser');
    }
    var state = document.readyState;
    if(state === 'complete' || state === 'interactive') {
        return setTimeout(callback, 0);
    }
    
    document.addEventListener('DOMContentLoaded', function onLoad() {
        callback();
    });
}