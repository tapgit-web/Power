import React from 'react'
import { Iot_chiller as IotChiller3 } from './IotChiller3.jsx'

const Home = () => {
    return (
        <div className="w-full min-h-screen bg-slate-50 pb-2 sm:pb-16 pt-14 sm:pt-20 flex flex-col">
            <IotChiller3 />
        </div>
    )
}

export default Home
