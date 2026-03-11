const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

// Simple mock server to host the HTML
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('test_mock_panel.html'));
});

server.listen(8081, () => {
    console.log('Mock server running at http://localhost:8081');
});

// Note: This script assumes a browser is running with --remote-debugging-port=9222
// and is navigated to http://localhost:8081.
// Since I cannot control the external browser directly with Node, 
// I will use a simplified simulation of the detection logic.

async function simulateDetection() {
    console.log('\n--- Simulating CDP Detection Logic ---');
    // Simulated button list from extension.js
    const SAFE_TEXTS = ['run', 'accept', 'expand'];
    const mockDOM = [
        { text: 'Run', tag: 'BUTTON' },
        { text: 'Accept', tag: 'BUTTON' },
        { text: 'Test Runner for Java', tag: 'BUTTON' }
    ];

    function textMatches(nodeText, target) {
        nodeText = nodeText.toLowerCase();
        if (nodeText === target) return true;
        if (nodeText.startsWith(target + ' alt+')) return true;
        return false;
    }

    mockDOM.forEach(node => {
        SAFE_TEXTS.forEach(target => {
            if (textMatches(node.text, target)) {
                console.log(`MATCH FOUND: "${node.text}" matches target "${target}"`);
            }
        });
    });

    console.log('\n--- Simulating Anti-Loop Logic ---');
    let consecutiveClickCount = 0;
    let lastClickedButton = null;
    let isStandby = false;

    function handleClick(btnText) {
        if (btnText === lastClickedButton) {
            consecutiveClickCount++;
        } else {
            consecutiveClickCount = 1;
            lastClickedButton = btnText;
        }

        if (consecutiveClickCount > 5) { // Threshold for simulation
            console.log(`LOOP DETECTED for "${btnText}" at count ${consecutiveClickCount}`);
            isStandby = true;
        } else {
            console.log(`Clicked "${btnText}", count: ${consecutiveClickCount}`);
        }
    }

    for (let i = 0; i < 7; i++) {
        if (isStandby) break;
        handleClick('Run');
    }
}

simulateDetection().then(() => {
    server.close();
    process.exit(0);
});
