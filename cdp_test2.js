const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

fs.writeFileSync('cdp_out_test2.json', '');

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
                        expression: 'Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "Accept all" && e.children.length === 0).map(e => ({tag: e.tagName, html: e.outerHTML, parent: e.parentElement ? e.parentElement.outerHTML : null, grandparent: e.parentElement && e.parentElement.parentElement ? e.parentElement.parentElement.outerHTML : null}))',
                        returnByValue: true
                    }
                }));
            });
            ws.on('message', data => {
                const msg = JSON.parse(data.toString());
                if (msg.id === 1 && msg.result && msg.result.result && msg.result.result.value && msg.result.result.value.length > 0) {
                    fs.appendFileSync('cdp_out_test2.json', '--- Page: ' + p.url + ' ---\n' + JSON.stringify(msg.result.result.value, null, 2) + '\n');
                }
                ws.close();
            });
        }
    });
}).on('error', e => console.error(e));
