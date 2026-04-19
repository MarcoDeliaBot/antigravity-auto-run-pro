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
                        function findButtons(root) {
                            let walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                            let node;
                            while ((node = walker.nextNode())) {
                                if (node.shadowRoot) findButtons(node.shadowRoot);
                                
                                let isBtn = node.tagName === 'BUTTON' 
                                            || node.getAttribute('role') === 'button'
                                            || (node.className && typeof node.className === 'string' && node.className.includes('button'));
                                            
                                if (isBtn) {
                                    results.push({
                                        tag: node.tagName,
                                        classes: node.className,
                                        textContent: (node.textContent || '').trim(),
                                        ariaLabel: node.getAttribute('aria-label'),
                                        title: node.getAttribute('title')
                                    });
                                }
                            }
                        }
                        findButtons(document.body);
                        return JSON.stringify(results, null, 2);
                    })();
                `;
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: { expression: script }
                }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m);
                if (msg.id === 1) {
                    fs.writeFileSync('all_buttons_workbench.json', msg.result.result.value);
                    console.log('Saved all_buttons_workbench.json');
                    process.exit(0);
                }
            });
        }
    });
});
