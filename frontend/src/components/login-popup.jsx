import React, { useState } from 'react';
import '../styles/login-popup.css';

export default function LoginPopup({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authFeedback, setAuthFeedback] = useState({ type: '', text: '' });

    const handleLogin = (e) => {
        e.preventDefault();

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();

        if (!normalizedEmail || !normalizedPassword) {
            setAuthFeedback({ type: 'error', text: 'Palun sisesta e-post ja parool.' });
            return;
        }

        const users = JSON.parse(localStorage.getItem('vocoUsers') || '{}');
        const existingUser = users[normalizedEmail];

        if (!existingUser) {
            users[normalizedEmail] = { password: normalizedPassword };
            localStorage.setItem('vocoUsers', JSON.stringify(users));
            setAuthFeedback({
                type: 'success',
                text: 'Kasutajat ei leitud. Uus konto registreeriti automaatselt.',
            });
            return;
        }

        if (existingUser.password !== normalizedPassword) {
            setAuthFeedback({ type: 'error', text: 'Vale parool.' });
            return;
        }

        setAuthFeedback({ type: 'success', text: 'Sisselogimine onnestus.' });
    };

    const handleGoogleLogin = () => {
        console.log('Login with Google');
    };

    if (!isOpen) return null;

    return (
        <div className="popup-overlay">
            <div className="popup-container">
                <div className="popup-header">
                    <h2>Login</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="login-btn">Login</button>
                </form>

                {authFeedback.text ? (
                    <p className={`auth-feedback auth-feedback--${authFeedback.type}`} role="status">
                        {authFeedback.text}
                    </p>
                ) : null}

                <hr></hr>
                <div className="divider">or</div>

                <button className="google-btn" onClick={handleGoogleLogin}>
                    <span>Login with Google</span>
                </button>
            </div>
        </div>
    );
}