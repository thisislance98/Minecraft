import { auth, googleProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../../config/firebase-client.js';

export class StoreUI {
    constructor(game) {
        this.game = game;
        this.user = null;
        this.tokens = 0;

        // Target the container in the Auth Modal
        this.container = document.getElementById('auth-content-placeholder');
        this.authModal = document.getElementById('auth-modal');
        this.authBtn = document.getElementById('auth-btn');
        this.authClose = document.getElementById('auth-close');

        // Styles for specific store elements
        this.injectStyles();

        // Setup auth modal interactions
        this.setupAuthModal();

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

        // Handle payment success/cancel URL parameters
        this.handlePaymentCallback();
    }

    handlePaymentCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');

        if (paymentStatus === 'success') {
            console.log('[StoreUI] Payment success detected, refreshing tokens...');

            // Show success message
            this.showPaymentNotification('Payment successful! Refreshing your balance...', 'success');

            // Wait a moment for webhook to process, then sync
            setTimeout(() => {
                if (this.user) {
                    this.syncWithBackend().then(() => {
                        this.showPaymentNotification(`Tokens updated! Balance: ${this.tokens.toLocaleString()}`, 'success');
                    });
                }
            }, 2000);

            // Clean up URL
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

        } else if (paymentStatus === 'cancel') {
            console.log('[StoreUI] Payment cancelled');
            this.showPaymentNotification('Payment cancelled', 'info');

            // Clean up URL
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }

    showPaymentNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'payment-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            font-family: 'VT323', monospace;
            font-size: 18px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            ${type === 'success' ? 'background: rgba(0, 255, 100, 0.9); color: #000;' : 'background: rgba(100, 100, 100, 0.9); color: #fff;'}
        `;
        notification.textContent = message;

        // Add animation styles
        if (!document.getElementById('payment-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'payment-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    setupAuthModal() {
        // Auth button click - open auth modal
        if (this.authBtn) {
            this.authBtn.addEventListener('click', () => {
                this.openAuthModal();
            });
        }

        // Close button
        if (this.authClose) {
            this.authClose.addEventListener('click', () => {
                this.closeAuthModal();
            });
        }

        // Click outside to close
        if (this.authModal) {
            this.authModal.addEventListener('click', (e) => {
                if (e.target === this.authModal) {
                    this.closeAuthModal();
                }
            });
        }
    }

    openAuthModal() {
        if (this.authModal) {
            this.authModal.classList.remove('hidden');
            this.updateUI(); // Refresh content
            if (this.user) {
                this.syncWithBackend();
            }
        }
    }

    closeAuthModal() {
        if (this.authModal) {
            this.authModal.classList.add('hidden');
        }
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
            this.container = document.getElementById('auth-content-placeholder');
            if (!this.container) return; // Still not ready?
        }

        if (!this.user) {
            this.container.innerHTML = `
                <div style="text-align: center;">
                    <p style="margin-bottom: 15px; color: #ccc; font-family: 'VT323', monospace; font-size: 18px;">Sign in to purchase tokens and support the server!</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="email" id="auth-email-input" class="auth-input" placeholder="Enter your email">
                        <input type="password" id="auth-password-input" class="auth-input" placeholder="Password (min 6 chars)">
                        <div style="display: flex; gap: 10px;">
                            <button id="auth-signin-btn" class="auth-btn" style="flex: 1;">Sign In</button>
                            <button id="auth-signup-btn" class="auth-btn auth-btn-secondary" style="flex: 1;">Sign Up</button>
                        </div>
                        <div class="auth-divider">
                            <span>or</span>
                        </div>
                        <button id="auth-google-btn" class="auth-btn auth-btn-google">
                            <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px; vertical-align: middle;">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                        </button>
                    </div>
                </div>
            `;
            const signInBtn = this.container.querySelector('#auth-signin-btn');
            const signUpBtn = this.container.querySelector('#auth-signup-btn');
            const googleBtn = this.container.querySelector('#auth-google-btn');
            const emailInput = this.container.querySelector('#auth-email-input');
            const passwordInput = this.container.querySelector('#auth-password-input');
            if (signInBtn) signInBtn.onclick = () => this.signIn(emailInput?.value, passwordInput?.value);
            if (signUpBtn) signUpBtn.onclick = () => this.signUp(emailInput?.value, passwordInput?.value);
            if (googleBtn) googleBtn.onclick = () => this.signInWithGoogle();
        } else {
            this.container.innerHTML = `
                <div class="auth-user-info">
                    <img src="${this.user.photoURL || 'https://via.placeholder.com/40'}" class="auth-avatar">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #fff;">${this.user.displayName || this.user.email}</div>
                        <div style="font-size: 12px; color: #aaa;">${this.user.email}</div>
                    </div>
                    <button id="auth-logout-btn" class="auth-btn" style="width: auto; padding: 6px 12px; font-size: 14px;">Sign Out</button>
                </div>
                
                <div class="auth-tokens-display">
                    💎 ${this.tokens.toLocaleString()} Tokens
                </div>
                
                <h4 class="auth-section-title">💰 Purchase Tokens</h4>
                <div class="auth-package-item">
                    <div>
                        <div style="font-weight: bold; color: #fff;">1,000 Tokens</div>
                        <div style="font-size: 12px; color: #aaa;">Starter Pack</div>
                    </div>
                    <button class="auth-btn" style="width: auto;" onclick="document.dispatchEvent(new CustomEvent('buy-tokens', { detail: 'tokens_1000' }))">
                        $1.00
                    </button>
                </div>
                <div class="auth-package-item">
                    <div>
                        <div style="font-weight: bold; color: #fff;">5,000 Tokens</div>
                        <div style="font-size: 12px; color: #aaa;">Value Pack</div>
                    </div>
                    <button class="auth-btn" style="width: auto;" onclick="document.dispatchEvent(new CustomEvent('buy-tokens', { detail: 'tokens_5000' }))">
                        $5.00
                    </button>
                </div>
                
                <div class="auth-footer">
                    🔒 Secure payments via Stripe
                </div>
            `;

            const logoutBtn = this.container.querySelector('#auth-logout-btn');
            if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
        }
    }

    async signIn(email, password) {
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            console.log('User signed in:', result.user);
            this.syncWithBackend();
        } catch (error) {
            console.error('Sign in failed:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert('Incorrect email or password. Please try again.');
            } else if (error.code === 'auth/user-not-found') {
                alert('No account found with this email. Please sign up first.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else {
                alert('Sign in failed: ' + error.message);
            }
        }
    }

    async signUp(email, password) {
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            console.log('User created:', result.user);
            this.syncWithBackend();
        } catch (error) {
            console.error('Sign up failed:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('An account with this email already exists. Please sign in instead.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else if (error.code === 'auth/weak-password') {
                alert('Password is too weak. Please use at least 6 characters.');
            } else {
                alert('Sign up failed: ' + error.message);
            }
        }
    }

    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log('User signed in with Google:', result.user);
            this.syncWithBackend();
        } catch (error) {
            console.error('Google sign in failed:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, no need to show error
                return;
            } else if (error.code === 'auth/popup-blocked') {
                alert('Popup was blocked. Please allow popups for this site.');
            } else {
                alert('Google sign in failed: ' + error.message);
            }
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
