const PORT = process.env.PORT || 5000;
const URL = `http://localhost:${PORT}/api/auth/test-delay`;

async function runTest() {
    const key = `test_key_${Date.now()}`;
    console.log(`Starting idempotency test with key: ${key}`);

    // Request 1: Start request (will take 1 second)
    const req1Promise = fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': key
        },
        body: JSON.stringify({ message: 'Hello World' })
    });

    // Request 2: Send duplicate request after 100ms
    await new Promise(r => setTimeout(r, 100));
    console.log('Sending duplicate concurrent request...');
    const req2 = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': key
        },
        body: JSON.stringify({ message: 'Hello World' })
    });

    console.log(`Concurrent Request Status: ${req2.status}`);
    const req2Body = await req2.json();
    console.log('Concurrent Request Response:', req2Body);

    if (req2.status !== 409) {
        console.error('FAIL: Concurrent request should have returned 409 Conflict!');
        process.exit(1);
    }
    console.log('PASS: Concurrent request blocked with 409 Conflict.');

    // Wait for request 1 to complete
    const req1 = await req1Promise;
    console.log(`Original Request Status: ${req1.status}`);
    const req1Body = await req1.json();
    console.log('Original Request Response:', req1Body);

    if (req1.status !== 200 || !req1Body.success) {
        console.error('FAIL: Original request should have succeeded with 200 OK!');
        process.exit(1);
    }
    console.log('PASS: Original request succeeded with 200 OK.');

    // Request 3: Send subsequent duplicate request
    console.log('Sending subsequent duplicate request...');
    const req3 = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': key
        },
        body: JSON.stringify({ message: 'Hello World' })
    });

    console.log(`Subsequent Request Status: ${req3.status}`);
    const req3Body = await req3.json();
    console.log('Subsequent Request Response:', req3Body);

    if (req3.status !== 200) {
        console.error('FAIL: Subsequent request should have returned 200 OK cached response!');
        process.exit(1);
    }

    if (JSON.stringify(req3Body) !== JSON.stringify(req1Body)) {
        console.error('FAIL: Subsequent cached response does not match original response!');
        process.exit(1);
    }
    console.log('PASS: Subsequent request returned identical cached response.');
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
    console.error('Test run error:', err);
    process.exit(1);
});
