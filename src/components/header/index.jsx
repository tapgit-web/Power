import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { doSignOut } from '../../firebase/auth'
import { MachineManagerModal } from '../common/MachineManagerModal'

const Header = () => {
    const navigate = useNavigate()
    const { userLoggedIn, currentUser, isAdmin } = useAuth()
    const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)

    // Avoid rendering nav until login state is determined
    if (userLoggedIn === null) {
        return null
    }

    return (
        <>
            <nav className="w-full z-30 fixed top-0 left-0 h-14 sm:h-16 border-b border-emerald-800 bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 flex items-center justify-between px-3 sm:px-6 md:px-12 shadow-md transition-all duration-300">
                {/* Left side: Pulsing telemetry status logo */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white"></span>
                    </span>
                    <Link to="/home" className="text-white hover:text-green-100 font-brand font-black text-base sm:text-xl md:text-2xl tracking-wider select-none transition-colors duration-300">
                        THE MONITOR
                    </Link>
                </div>

                {/* Right side: Actions & User Info */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                    {userLoggedIn ? (
                        <>
                            {/* Current Logged-in User Badge */}
                            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 text-white backdrop-blur-sm select-none" title={currentUser?.email || ''}>
                                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500/90 border border-white/30 flex items-center justify-center text-[10px] sm:text-xs font-black uppercase text-white shadow-inner">
                                    {currentUser?.email ? currentUser.email.charAt(0) : 'U'}
                                </div>
                                <span 
                                    className="hidden md:inline text-xs font-semibold text-white max-w-[120px] sm:max-w-[180px] truncate"
                                >
                                    {currentUser?.email || 'User'}
                                </span>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={() => setIsMachineModalOpen(true)}
                                    className="px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold text-emerald-950 bg-white hover:bg-emerald-50 rounded-lg sm:rounded-xl border border-emerald-200 transition-all duration-300 shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
                                    title="Add or edit machine list and names in Firebase (Admin Only)"
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">Machines</span>
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    doSignOut().then(() => navigate('/login'))
                                }}
                                className="px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold text-white bg-red-600/85 hover:bg-red-600 rounded-lg sm:rounded-xl border border-red-500/30 hover:border-transparent transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link
                            to="/login"
                            className="px-5 py-2 text-xs md:text-sm font-bold text-emerald-800 bg-white hover:bg-emerald-50 rounded-xl transition-all duration-300 shadow-sm active:scale-95"
                        >
                            Login
                        </Link>
                    )}
                </div>
            </nav>

            {isAdmin && (
                <MachineManagerModal
                    isOpen={isMachineModalOpen}
                    onClose={() => setIsMachineModalOpen(false)}
                />
            )}
        </>
    )
}

export default Header