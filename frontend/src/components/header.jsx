import React from 'react';

import '../styles/header.css';
import { FaUser } from "react-icons/fa";
import LoginPopup from './login-popup';

export default function Header({ isLoginOpen, setLoginOpen }) {

    return (
        <header className="header">

            <div className="header__middle">
                <h1 className="header__title">Voco Place</h1>
            </div>

            <div className="header__right">
                <button className="header__login-button" onClick={() => setLoginOpen(true)}><FaUser /> Login</button>
                <LoginPopup isOpen={isLoginOpen} onClose={() => setLoginOpen(false)} />
            </div>

        </header>
    );
}