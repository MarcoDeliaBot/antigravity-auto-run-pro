const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const port = 9222;

const script = `
(function() {
    function findText(root, results) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        var node;
        while (node = walker.nextNode()) {
            if (node.nodeType === 3) { // TEXT_NODE
                var txt = node.textContent.trim();
                if (txt.toLowerCase().includes('accept all')) {
                    results.push({
                        text: txt,
                        parent: node.parentElement.tagName,
                        html: node.parentElement.outerHTML.substring(0, 500)
                    });
                }
            }
            if (node.shadowRoot) {
                findText(node.shadowRoot, results);
            }
        }
    }
    var res = [];
    findText(document.body, res);
    return res;
})()
`;

http.get(`http://127.0.0.1:${port}/json/list`, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', async () => {
        let pages = JSON.parse(d).filter(p => p.webSocketDebuggerUrl);
        let findings = [];
        for (let p of pages) {
            await new Promise(resolve => {
                let ws = new WebSocket(p.webSocketDebuggerUrl);
                ws.on('open', () => {
                    ws.send(JSON.stringify({
                        id: 1, method: 'Runtime.evaluate', params: {
                            expression: script,
                            returnByValue: true
                        }
                    }));
                });
                ws.on('message', data => {
                    const msg = JSON.parse(data.toString());
                    if (msg.id === 1 && msg.result && msg.result.result && msg.result.result.value) {
                        if (msg.result.result.value.length > 0) {
                            findings.push({
                                page: p.title,
                                url: p.url,
                                matches: msg.result.result.value
                            });
                        }
                    }
                    ws.close();
                    resolve();
                });
                ws.on('error', resolve);
            });
        }
        fs.writeFileSync('shadow_findings.json', JSON.stringify(findings, null, 2));
        console.log('Search completed: shadow_findings.json');
    });
}).on('error', e => console.error(e));
