import { auth, googleProvider, signInWithPopup, signOut } from '../../config/firebase-client.js';

export class StoreUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.user = null;
        this.tokens = 0;

        // CSS
        this.injectStyles();

        // UI Elements
        this.container = this.createUI();
        document.body.appendChild(this.container);

        // Listen for auth state
        auth.onAuthStateChanged((user) => {
            this.user = user;
            this.updateUI();

            const authBtn = document.getElementById('auth-btn');
            if (user) {
                // Determine user token balance from backend
                this.syncWithBackend();
                if (authBtn) authBtn.textContent = `💎 ${this.tokens.toLocaleString()}`;
            } else {
                if (authBtn) authBtn.textContent = '👤 Sign In';
            }
        });

        // Initially hide
        this.container.style.display = 'none';
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #store-ui {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                background: rgba(20, 20, 30, 0.95);
                border: 2px solid #00ffcc;
                border-radius: 12px;
                padding: 24px;
                font-family: 'VT323', monospace;
                color: white;
                z-index: 5000;
                box-shadow: 0 0 40px rgba(0, 255, 204, 0.2);
            }
            .store-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid rgba(0, 255, 204, 0.3);
                padding-bottom: 10px;
            }
            .store-title {
                font-size: 24px;
                color: #00ffcc;
                margin: 0;
            }
            .store-close {
                background: none;
                border: none;
                color: #ff6666;
                font-size: 24px;
                cursor: pointer;
            }
            .store-content {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .store-btn {
                background: rgba(0, 255, 204, 0.1);
                border: 1px solid #00ffcc;
                color: #00ffcc;
                padding: 10px;
                font-family: inherit;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
                border-radius: 4px;
            }
            .store-btn:hover {
                background: rgba(0, 255, 204, 0.3);
            }
            .store-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .store-user-info {
                background: rgba(255, 255, 255, 0.1);
                padding: 10px;
                border-radius: 4px;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .store-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
            }
            .store-tokens-display {
                font-size: 20px;
                text-align: center;
                margin: 10px 0;
                color: #ffd700;
            }
            .package-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 255, 255, 0.05);
                padding: 10px;
                border-radius: 4px;
            }
            .package-price {
                color: #00ffcc;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    createUI() {
        const div = document.createElement('div');
        div.id = 'store-ui';
        div.innerHTML = `
            <div class="store-header">
                <h2 class="store-title">💎 Token Store</h2>
                <button class="store-close">&times;</button>
            </div>
            <div id="store-content" class="store-content">
                <!-- Dynamic content -->
            </div>
        `;

        div.querySelector('.store-close').onclick = () => this.toggle(false);
        return div;
    }

    updateUI() {
        const content = this.container.querySelector('#store-content');
        if (!this.user) {
            content.innerHTML = `
                <p>Sign in to purchase tokens and support the server!</p>
                <button id="store-login-btn" class="store-btn">Sign in with Google</button>
            `;
            content.querySelector('#store-login-btn').onclick = () => this.login();
        } else {
            content.innerHTML = `
                <div class="store-user-info">
                    <img src="${this.user.photoURL || 'https://via.placeholder.com/32'}" class="store-avatar">
                    <div>
                        <div>${this.user.displayName || this.user.email}</div>
                        <div style="font-size: 12px; color: #aaa;">${this.user.email}</div>
                    </div>
                    <button id="store-logout-btn" style="margin-left: auto; background: none; border: 1px solid #666; color: #aaa; cursor: pointer; padding: 2px 6px; border-radius: 4px;">Sign Out</button>
                </div>
                
                <div class="store-tokens-display">
                    Balance: 💎 ${this.tokens.toLocaleString()} Tokens
                </div>
                
                <h3>Packages</h3>
                <div class="package-item">
                    <div>
                        <div>1,000 Tokens</div>
                        <div style="font-size: 12px; color: #aaa;">Starter Pack</div>
                    </div>
                    <button class="store-btn" onclick="document.dispatchEvent(new CustomEvent('buy-tokens', { detail: 'tokens_1000' }))">
                        $1.00
                    </button>
                </div>
                 <div class="package-item">
                    <div>
                        <div>5,000 Tokens</div>
                        <div style="font-size: 12px; color: #aaa;">Value Pack</div>
                    </div>
                    <button class="store-btn" onclick="document.dispatchEvent(new CustomEvent('buy-tokens', { detail: 'tokens_5000' }))">
                        $5.00
                    </button>
                </div>
                
                <div style="margin-top: 10px; font-size: 12px; color: #888; text-align: center;">
                    Secure payments via Stripe
                </div>
            `;

            content.querySelector('#store-logout-btn').onclick = () => signOut(auth);

            // Re-attach listeners for dynamically created buttons (using event delegation or checking event)
            // Or simpler: add event listener to container and check target
            // But I used onclick attribute with CustomEvent for brevity in innerHTML
        }
    }

    // Listen for custom events handled at document level or handle internally?
    // Let's handle internally by standard listeners after render
    setupPurchaseListeners() {
        // This would be better if I didn't verify innerHTML strings
        // But for now, I'll rely on the document listeners I'll set up in constructor?
        // Actually, let's just use event delegation on content
        this.container.querySelector('#store-content').addEventListener('click', (e) => {
            // Find closest button
            const btn = e.target.closest('button');
            if (!btn) return;

            // Handle Buy Buttons via detail
            // Note: onclick attributes in innerHTML fire BEFORE this listener typically?
            // Actually, better to just bind clicks after render.
        });
    }

    async login() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log('User signed in:', result.user);
            // Sync with backend immediately
            this.syncWithBackend();
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed: ' + error.message);
        }
    }

    async syncWithBackend() {
        if (!this.user) return;

        try {
            const idToken = await this.user.getIdToken();
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            if (res.ok) {
                const data = await res.json();
                console.log('Backend sync success:', data);
                this.tokens = data.tokens || 0;
                this.tokens = data.tokens || 0;
                this.updateUI(); // Refresh balance display
                const authBtn = document.getElementById('auth-btn');
                if (authBtn) authBtn.textContent = `💎 ${this.tokens.toLocaleString()}`;
            } else {
                console.error('Backend sync failed:', await res.text());
            }
        } catch (e) {
            console.error('Sync error:', e);
        }
    }

    async buyPackage(packageId) {
        if (!this.user) return this.login();

        try {
            const idToken = await this.user.getIdToken(); // Stripe endpoint might need auth? 
            // My current stripe route uses body userId
            // Ideally it should verify token too.
            // But for now, I pass userId

            // Show loading state?
            const btn = document.activeElement;
            const originalText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${idToken}` // If I update stripe route
                },
                body: JSON.stringify({
                    userId: this.user.uid,
                    packageId: packageId,
                    successUrl: window.location.origin + '?payment=success',
                    cancelUrl: window.location.origin + '?payment=cancel'
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                }
            } else {
                alert('Purchase failed');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (e) {
            console.error('Purchase error:', e);
            alert('Purchase error');
        }
    }

    toggle(state) {
        if (state === undefined) state = !this.isOpen;
        this.isOpen = state;
        this.container.style.display = this.isOpen ? 'block' : 'none';

        if (this.isOpen) {
            // Unlock mouse
            document.exitPointerLock();
            // Also sync balance if user is there
            if (this.user) this.syncWithBackend();
        } else {
            // Maybe lock mouse back if game wants?
            // Usually user clicks back on canvas.
        }
    }
}

// Global listener for the onClick events in HTML
document.addEventListener('buy-tokens', (e) => {
    // We need the instance... better if I export singleton or attach to window?
    // Or just find the instance on game?
    // Hack: Attach to window.__VOXEL_GAME__.storeUI
    if (window.__VOXEL_GAME__ && window.__VOXEL_GAME__.storeUI) {
        window.__VOXEL_GAME__.storeUI.buyPackage(e.detail);
    }
});

document.addEventListener('token-balance-update', (e) => {
    if (window.__VOXEL_GAME__ && window.__VOXEL_GAME__.storeUI) {
        const store = window.__VOXEL_GAME__.storeUI;
        store.tokens = e.detail;
        store.updateUI();
        // Also update Auth Button text
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) authBtn.textContent = `💎 ${store.tokens.toLocaleString()}`;
    }
});
