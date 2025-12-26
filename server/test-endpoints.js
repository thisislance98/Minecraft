const API_URL = 'http://localhost:2567/api';

async function testEndpoints() {
    console.log('Testing Backend Endpoints...');

    // 1. Test Health Check
    try {
        const res = await fetch('http://localhost:2567/health');
        if (res.ok) {
            const data = await res.json();
            console.log('✅ Health Check:', res.status, data);
        } else {
            console.error('❌ Health Check Failed:', res.status, res.statusText);
        }
    } catch (e) {
        console.error('❌ Health Check Failed:', e.message);
    }

    // 2. Test Checkout (Validation)
    try {
        const res = await fetch(`${API_URL}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (res.status === 400) {
            const data = await res.json();
            console.log('✅ Checkout Validation:', data.error);
        } else {
            console.log(`❌ Checkout unexpected status: ${res.status}`);
        }
    } catch (e) {
        console.error('❌ Checkout Check Failed:', e.message);
    }

    // 3. Test Invalid Auth
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (res.status === 400) {
            const data = await res.json();
            console.log('✅ Auth Validation:', data.error);
        } else {
            console.log(`❌ Auth unexpected status: ${res.status}`);
        }
    } catch (e) {
        console.error('❌ Auth Check Failed:', e.message);
    }
}

testEndpoints();
