import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineArrowLeft } from 'react-icons/hi';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error('Please enter username and password');
            return;
        }
        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('Login successful!');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) {
            toast.error('Please enter your email address');
            return;
        }
        setForgotLoading(true);
        try {
            const res = await api.post('/auth/forgot-password', { email: forgotEmail });
            toast.success(res.data.message);
            setForgotSent(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to send reset email');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-50 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-52 h-12 rounded-2xl bg-white shadow-lg shadow-cyan-500/20 mb-4 overflow-hidden border border-slate-100">
                        <img src="/logo.jpeg" alt="Peninsula Laundries Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                        Peninsula Laundries
                    </h1>
                    <p className="text-slate-600 mt-2 text-sm">Laundry Management System</p>
                </div>

                {/* Login Card */}
                <div className="backdrop-blur-xl bg-white/80 border border-slate-200 rounded-2xl p-8 shadow-xl">
                    {showForgotPassword ? (
                        /* Forgot Password Form */
                        <>
                            <button
                                onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
                            >
                                <HiOutlineArrowLeft className="w-4 h-4" /> Back to Login
                            </button>
                            <h2 className="text-xl font-semibold text-slate-900 mb-1">Forgot Password?</h2>
                            <p className="text-slate-500 text-sm mb-6">Enter your email and we'll send you a reset link</p>

                            {forgotSent ? (
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <HiOutlineMail className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Email Sent!</h3>
                                    <p className="text-slate-500 text-sm">Check your inbox for the password reset link. It expires in 30 minutes.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleForgotPassword} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Email Address</label>
                                        <div className="relative">
                                            <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                            <input
                                                type="email"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="Enter your registered email"
                                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-200"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/30"
                                    >
                                        {forgotLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Sending...
                                            </span>
                                        ) : (
                                            'Send Reset Link'
                                        )}
                                    </button>
                                </form>
                            )}
                        </>
                    ) : (
                        /* Login Form */
                        <>
                            <h2 className="text-xl font-semibold text-slate-900 mb-1">Welcome Back</h2>
                            <p className="text-slate-500 text-sm mb-6">Sign in to your account</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Username */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Email or Username</label>
                                    <div className="relative">
                                        <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter email or username"
                                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-200"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-slate-600">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            className="text-xs text-cyan-600 hover:text-cyan-500 transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter password"
                                            className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-md shadow-cyan-500/30"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Signing in...
                                        </span>
                                    ) : (
                                        'Sign In'
                                    )}
                                </button>
                            </form>
                        </>
                    )}


                </div>

                {/* Powered By Credit */}
                <div className="mt-8 text-center animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                        Powered by <span className="text-cyan-600 font-bold">SusaLabs</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
