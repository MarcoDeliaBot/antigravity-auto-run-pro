const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

http.get('http://127.0.0.1:9333/json/list', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const pages = JSON.parse(data).filter(p => p.webSocketDebuggerUrl);
        const workbench = pages.find(p => p.url.includes('workbench-jetski-agent.html'));
        if (workbench) {
            const ws = new WebSocket(workbench.webSocketDebuggerUrl);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: 'document.body.outerHTML'
                    }
                }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m);
                if (msg.id === 1) {
                    fs.writeFileSync('agent_dom.html', msg.result.result.value);
                    console.log('Saved agent_dom.html');
                    process.exit(0);
                }
            });
        }
    });
});
