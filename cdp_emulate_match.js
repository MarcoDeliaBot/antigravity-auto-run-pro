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
                const script = `
                    (function() {
                        function getDirectText(node) {
                            var text = '';
                            for (var i = 0; i < node.childNodes.length; i++) {
                                if (node.childNodes[i].nodeType === 3) {
                                    text += node.childNodes[i].textContent;
                                }
                            }
                            return text.trim().toLowerCase();
                        }
                        
                        function textMatches(nodeText, target) {
                            var n = (nodeText || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                            var t = target;
                            if (n === t) return true;
                            if (n.startsWith(t + ' alt+')) return true;
                            if (n.startsWith(t + ' ctrl+')) return true;
                            return false;
                        }

                        let found = [];
                        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
                        var node;
                        while ((node = walker.nextNode())) {
                            var textLower = (node.textContent || '').trim().toLowerCase();
                            if (textLower.includes('run')) {
                                found.push({
                                    tag: node.tagName,
                                    directText: getDirectText(node),
                                    fullText: textLower,
                                    className: node.className
                                });
                            }
                        }
                        return JSON.stringify(found);
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
                    console.log('--- ' + p.url);
                    console.log(msg.result.result.value);
                }
            });
            setTimeout(() => { ws.close(); process.exit(0); }, 2000);
        });
    });
});
