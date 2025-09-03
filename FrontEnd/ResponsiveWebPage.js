
        class LoginPage {
            constructor() {
                this.form = document.getElementById('loginForm');
                this.submitBtn = document.getElementById('submitBtn');
                this.btnText = document.getElementById('btn-text');
                this.btnLoading = document.getElementById('btn-loading');
                this.alertContainer = document.getElementById('alert-container');
                
                this.init();
            }

            init() {
                this.form.addEventListener('submit', this.handleSubmit.bind(this));
                
                // Real-time validation
                document.getElementById('email').addEventListener('blur', () => this.validateEmail());
                document.getElementById('password').addEventListener('blur', () => this.validatePassword());
                
                // Clear errors on input
                document.getElementById('email').addEventListener('input', () => this.clearError('email'));
                document.getElementById('password').addEventListener('input', () => this.clearError('password'));
            }

            validateEmail() {
                const email = document.getElementById('email');
                const emailError = document.getElementById('email-error');
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                if (!email.value.trim()) {
                    this.showError('email', 'Email is required');
                    return false;
                } else if (!emailRegex.test(email.value)) {
                    this.showError('email', 'Please enter a valid email address');
                    return false;
                }

                this.clearError('email');
                return true;
            }

            validatePassword() {
                const password = document.getElementById('password');
                const passwordError = document.getElementById('password-error');

                if (!password.value.trim()) {
                    this.showError('password', 'Password is required');
                    return false;
                } else if (password.value.length < 6) {
                    this.showError('password', 'Password must be at least 6 characters');
                    return false;
                }

                this.clearError('password');
                return true;
            }

            showError(field, message) {
                const input = document.getElementById(field);
                const errorDiv = document.getElementById(`${field}-error`);
                
                input.classList.add('error');
                errorDiv.textContent = `⚠ ${message}`;
                errorDiv.style.display = 'flex';
            }

            clearError(field) {
                const input = document.getElementById(field);
                const errorDiv = document.getElementById(`${field}-error`);
                
                input.classList.remove('error');
                errorDiv.style.display = 'none';
            }

            showAlert(type, message) {
                const alertDiv = document.createElement('div');
                alertDiv.className = `alert alert-${type}`;
                
                const icon = type === 'success' ? '✓' : '✕';
                alertDiv.innerHTML = `<span>${icon}</span> ${message}`;
                
                this.alertContainer.innerHTML = '';
                this.alertContainer.appendChild(alertDiv);

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 5000);
            }

            setLoading(isLoading) {
                this.submitBtn.disabled = isLoading;
                
                if (isLoading) {
                    this.btnText.style.display = 'none';
                    this.btnLoading.style.display = 'inline-block';
                } else {
                    this.btnText.style.display = 'inline';
                    this.btnLoading.style.display = 'none';
                }
            }

            async mockApiCall(email, password) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Mock API responses
                const testCredentials = {
                    'demo@example.com': 'demo123',
                    'admin@test.com': 'admin123'
                };

                if (testCredentials[email] === password) {
                    return {
                        success: true,
                        user: {
                            email: email,
                            name: email.split('@')[0],
                            id: Math.random().toString(36).substr(2, 9)
                        },
                        token: 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9)
                    };
                } else {
                    throw new Error('Invalid email or password');
                }
            }

            async handleSubmit(e) {
                e.preventDefault();
                
                // Clear previous alerts
                this.alertContainer.innerHTML = '';

                // Validate all fields
                const isEmailValid = this.validateEmail();
                const isPasswordValid = this.validatePassword();

                if (!isEmailValid || !isPasswordValid) {
                    this.showAlert('error', 'Please fix the errors above');
                    return;
                }

                const formData = new FormData(this.form);
                const email = formData.get('email');
                const password = formData.get('password');
                const remember = formData.get('remember');

                this.setLoading(true);

                try {
                    const response = await this.mockApiCall(email, password);
                    
                    // Simulate storing auth token
                    if (remember) {
                        // In a real app, you'd use secure storage
                        console.log('Remember me checked - would store token securely');
                    }

                    this.showAlert('success', `Welcome back, ${response.user.name}! Redirecting...`);
                    
                    // Simulate redirect after success
                    setTimeout(() => {
                        console.log('Would redirect to dashboard');
                        this.showAlert('success', 'Login successful! (This is a demo)');
                    }, 2000);

                } catch (error) {
                    this.showAlert('error', error.message);
                } finally {
                    this.setLoading(false);
                }
            }
        }

        // Initialize the login page
        document.addEventListener('DOMContentLoaded', () => {
            new LoginPage();

            // Add some helpful demo info
            setTimeout(() => {
                const demoInfo = document.createElement('div');
                demoInfo.style.cssText = `
                    position: fixed;
                    top: 1rem;
                    right: 1rem;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    max-width: 250px;
                    z-index: 1000;
                `;
                demoInfo.innerHTML = `
                    <strong>Demo Credentials:</strong><br>
                    📧 demo@example.com<br>
                    🔒 demo123<br><br>
                    📧 admin@test.com<br>
                    🔒 admin123
                `;
                document.body.appendChild(demoInfo);

                // Auto-hide demo info
                setTimeout(() => demoInfo.remove(), 10000);
            }, 1000);
        });
    