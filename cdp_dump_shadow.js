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
                const script = `
                    (function() {
                        let results = [];
                        function findText(root) {
                            let walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                            let node;
                            while ((node = walker.nextNode())) {
                                if (node.shadowRoot) findText(node.shadowRoot);
                                if (node.tagName.includes('BUTTON') || node.getAttribute('role') === 'button') {
                                    results.push({
                                        tag: node.tagName,
                                        classes: node.className,
                                        textContent: node.textContent,
                                        innerHTML: node.innerHTML
                                    });
                                }
                            }
                        }
                        findText(document.body);
                        return JSON.stringify(results);
                    })();
                `;
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: script
                    }
                }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m);
                if (msg.id === 1) {
                    fs.writeFileSync('shadow_buttons.json', msg.result.result.value);
                    console.log('Saved shadow_buttons.json');
                    process.exit(0);
                }
            });
        }
    });
});
