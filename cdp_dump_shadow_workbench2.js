const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

http.get('http://127.0.0.1:9333/json/list', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const pages = JSON.parse(data).filter(p => p.webSocketDebuggerUrl);
        const workbench = pages.find(p => p.url.includes('workbench.html') && !p.url.includes('jetski'));
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
                                let text = (node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                                if (text.includes('run alt+')) {
                                    results.push({
                                        tag: node.tagName,
                                        classes: node.className,
                                        textContent: text,
                                        isButton: (node.tagName === 'BUTTON' || node.getAttribute('role') === 'button' || node.onclick != null || node.getAttribute('tabindex') === '0'),
                                        hasClick: typeof node.onclick === 'function'
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
                    fs.writeFileSync('shadow_buttons_workbench2.json', msg.result.result.value);
                    console.log('Saved shadow_buttons_workbench2.json');
                    process.exit(0);
                }
            });
        }
    });
});
