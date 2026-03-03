const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const port = 9222;

http.get(`http://127.0.0.1:${port}/json/list`, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', async () => {
        let pages = JSON.parse(d).filter(p => p.webSocketDebuggerUrl);
        let results = [];
        for (let p of pages) {
            await new Promise(resolve => {
                let ws = new WebSocket(p.webSocketDebuggerUrl);
                ws.on('open', () => {
                    ws.send(JSON.stringify({
                        id: 1, method: 'Runtime.evaluate', params: {
                            expression: '({title: document.title, url: location.href, body: document.body.innerText, html: document.body.innerHTML})',
                            returnByValue: true
                        }
                    }));
                });
                ws.on('message', data => {
                    const msg = JSON.parse(data.toString());
                    if (msg.id === 1 && msg.result && msg.result.result && msg.result.result.value) {
                        results.push({
                            page: p.title,
                            url: p.url,
                            data: msg.result.result.value
                        });
                    }
                    ws.close();
                    resolve();
                });
                ws.on('error', resolve);
            });
        }
        fs.writeFileSync('cdp_full_dom_dump.json', JSON.stringify(results, null, 2));
        console.log('Dump completed: cdp_full_dom_dump.json');
    });
}).on('error', e => console.error(e));
