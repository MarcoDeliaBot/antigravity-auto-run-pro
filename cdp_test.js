const http = require('http');
const WebSocket = require('ws');
http.get('http://127.0.0.1:9222/json/list', res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        let pages = JSON.parse(d).filter(p => p.webSocketDebuggerUrl);
        for (let p of pages) {
            let ws = new WebSocket(p.webSocketDebuggerUrl);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    id: 1, method: 'Runtime.evaluate', params: {
                        expression: 'Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "Accept all").map(e => ({tag: e.tagName, cls: e.className, txt: e.textContent.trim()}))',
                        returnByValue: true
                    }
                }));
            });
            ws.on('message', data => {
                const msg = JSON.parse(data.toString());
                if (msg.id === 1) {
                    console.log('--- Page:', p.url, '---');
                    if (msg.result && msg.result.result && msg.result.result.value) {
                        console.log(JSON.stringify(msg.result.result.value, null, 2));
                    } else {
                        console.log("No result value", JSON.stringify(msg));
                    }
                }
                ws.close();
            });
        }
    });
}).on('error', e => console.error(e));
