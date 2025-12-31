import { auth, googleProvider, signInWithPopup, signOut } from '../../config/firebase-client.js';

export class StoreUI {
    constructor(game) {
        this.game = game;
        this.user = null;
        this.tokens = 0;

        // Target the container in Settings Modal
        // Note: This might be null if called too early, so we check again in updateUI
        this.container = document.getElementById('store-content-placeholder');

        // Styles for specific store elements
        this.injectStyles();

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
    }

    injectStyles() {
        if (document.getElementById('store-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'store-ui-styles';
        style.textContent = `
            .store-user-info {
                background: rgba(255, 255, 255, 0.1);
                padding: 10px;
                border-radius: 4px;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
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
                margin-bottom: 8px;
            }
            .store-btn {
                background: rgba(0, 255, 204, 0.1);
                border: 1px solid #00ffcc;
                color: #00ffcc;
                padding: 8px 16px;
                font-family: inherit;
                font-size: 16px;
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
        `;
        document.head.appendChild(style);
    }

    updateUI() {
        if (!this.container) {
            this.container = document.getElementById('store-content-placeholder');
            if (!this.container) return; // Still not ready?
        }

        if (!this.user) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 15px;">Sign in to purchase tokens and support the server!</p>
                    <button id="store-login-btn" class="store-btn">Sign in with Google</button>
                </div>
            `;
            const loginBtn = this.container.querySelector('#store-login-btn');
            if (loginBtn) loginBtn.onclick = () => this.login();
        } else {
            this.container.innerHTML = `
                <div class="store-user-info">
                    <img src="${this.user.photoURL || 'https://via.placeholder.com/32'}" class="store-avatar">
                    <div style="flex: 1;">
                        <div>${this.user.displayName || this.user.email}</div>
                        <div style="font-size: 12px; color: #aaa;">${this.user.email}</div>
                    </div>
                    <button id="store-logout-btn" style="background: none; border: 1px solid #666; color: #aaa; cursor: pointer; padding: 2px 6px; border-radius: 4px;">Sign Out</button>
                </div>
                
                <div class="store-tokens-display">
                    Balance: 💎 ${this.tokens.toLocaleString()} Tokens
                </div>
                
                <h4 style="margin: 15px 0 10px 0;">Packages</h4>
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
                
                <div style="margin-top: 15px; font-size: 12px; color: #888; text-align: center;">
                    Secure payments via Stripe
                </div>
            `;

            const logoutBtn = this.container.querySelector('#store-logout-btn');
            if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
        }
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
            console.log('Processing purchase for:', packageId);
            const idToken = await this.user.getIdToken();

            // Visual feedback
            const btn = document.activeElement;
            let originalText = '';
            if (btn && btn.tagName === 'BUTTON') {
                originalText = btn.textContent;
                btn.textContent = 'Processing...';
                btn.disabled = true;
            }

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${idToken}` 
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
                if (btn && btn.tagName === 'BUTTON') {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }
        } catch (e) {
            console.error('Purchase error:', e);
            alert('Purchase error');
        }
    }

    // Refresh data when settings are opened
    refresh() {
        this.updateUI(); // Ensure container is found if it wasn't
        if (this.user) {
            this.syncWithBackend();
        }
    }
}

// Global listener for the buy-tokens events
document.addEventListener('buy-tokens', (e) => {
    if (window.__VOXEL_GAME__ && window.__VOXEL_GAME__.storeUI) {
        window.__VOXEL_GAME__.storeUI.buyPackage(e.detail);
    }
});
