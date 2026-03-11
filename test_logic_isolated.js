const SAFE_TEXTS = [
    'run', 'accept', 'esegui', 'accetta', 'continue', 'proceed', 'continua', 'procedi',
    'always run', 'esegui sempre', 'allow once', 'consenti una volta', 'expand', 'espandi',
    'requires input', 'richiede input',
];
const UNSAFE_TEXTS = [
    'always allow', 'allow this conversation', 'allow',
    'consenti sempre', 'consenti in questa conversazione', 'consenti',
];

function buildPermissionScript(customTexts, godMode, standbyButton) {
    const allTexts = godMode
        ? [...SAFE_TEXTS, ...UNSAFE_TEXTS, ...customTexts]
        : [...SAFE_TEXTS, ...customTexts];
    return { allTexts, godMode, standbyButton };
}

// Test cases
console.log('--- Test Case 1: Safe Mode ---');
const case1 = buildPermissionScript([], false, null);
console.log('God Mode:', case1.godMode);
console.log('Includes "run":', case1.allTexts.includes('run'));
console.log('Includes "allow":', case1.allTexts.includes('allow'));

console.log('\n--- Test Case 2: God Mode ---');
const case2 = buildPermissionScript([], true, null);
console.log('God Mode:', case2.godMode);
console.log('Includes "run":', case2.allTexts.includes('run'));
console.log('Includes "allow":', case2.allTexts.includes('allow'));

console.log('\n--- Test Case 3: Custom Texts ---');
const case3 = buildPermissionScript(['custom-btn'], false, null);
console.log('Includes "custom-btn":', case3.allTexts.includes('custom-btn'));
