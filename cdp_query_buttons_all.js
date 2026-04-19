const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9333/json/list', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const pages = JSON.parse(data).filter(p => p.webSocketDebuggerUrl);
        pages.forEach(p => {
            const ws = new WebSocket(p.webSocketDebuggerUrl);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: `JSON.stringify(Array.from(document.querySelectorAll('button, [role="button"], a.monaco-button')).map(b => b.textContent).filter(t => t.toLowerCase().includes('run')))`
                    }
                }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m);
                if (msg.id === 1) {
                    console.log('--- ' + p.url);
                    console.log(msg.result.result ? msg.result.result.value : msg.result);
                }
            });
        });
    });
});
