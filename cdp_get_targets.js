const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9333/json/list', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const pages = JSON.parse(data).filter(p => p.webSocketDebuggerUrl);
        const workbench = pages.find(p => p.url.includes('workbench.html'));
        if (workbench) {
            const ws = new WebSocket(workbench.webSocketDebuggerUrl);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Target.getTargets'
                }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m);
                if (msg.id === 1) {
                    console.log(JSON.stringify(msg.result.targetInfos, null, 2));
                    process.exit(0);
                }
            });
        }
    });
});
