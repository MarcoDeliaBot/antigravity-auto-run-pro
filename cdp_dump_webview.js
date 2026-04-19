
const http = require('http');
const WebSocket = require('ws');

const PORT = 9333;

async function getPages() {
    return new Promise((resolve) => {
        http.get(`http://127.0.0.1:${PORT}/json/list`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', () => resolve([]));
    });
}

const DUMP_SCRIPT = `
(function() {
    function dump(root) {
        var results = [];
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
            var text = (node.textContent || '').trim();
            if (text.length > 0 && text.length < 100) {
                results.push({
                    tag: node.tagName,
                    text: text,
                    id: node.id,
                    class: node.className,
                    visible: node.getBoundingClientRect().width > 0
                });
            }
            if (node.shadowRoot) {
                results = results.concat(dump(node.shadowRoot));
            }
        }
        return results;
    }
    return JSON.stringify(dump(document.body));
})()
`;

(async () => {
    const pages = await getPages();
    const webview = pages.find(p => p.url.startsWith('vscode-webview://'));
    if (!webview) {
        console.log("No webview found!");
        process.exit(1);
    }

    console.log(`Dumping webview: ${webview.url}`);
    const ws = new WebSocket(webview.webSocketDebuggerUrl);
    ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: DUMP_SCRIPT } }));
    });
    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        const results = JSON.parse(msg.result.result.value);
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    });
})();
